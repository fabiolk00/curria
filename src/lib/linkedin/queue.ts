import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { fetchLinkedInProfile, mapLinkdAPIToCvState } from './linkdapi'
import { logError, logInfo } from '@/lib/observability/structured-log'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

// Create a Redis connection for BullMQ
const createRedisConnection = () => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
  }

  // Extract host and port from the Redis URL
  // Format: https://host:port
  const url = new URL(redisUrl)
  const host = url.hostname
  const port = url.port ? parseInt(url.port, 10) : 6379

  return new Redis({
    host,
    port,
    password: redisToken,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
  })
}

const redis = createRedisConnection()

export interface LinkedInProfileJob {
  appUserId: string
  linkedinUrl: string
}

export interface LinkedInProfileJobResult {
  success: boolean
  appUserId: string
  message?: string
}

export const linkedinQueue = new Queue<LinkedInProfileJob>('linkedin-profile-extract', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    // Keep completed jobs so status polling can verify success.
    // If removeOnComplete were true, completed jobs disappear from queue,
    // causing status polling to return 404 even though extraction succeeded.
    // A cron job cleans up old jobs (>24h) to prevent queue bloat.
    removeOnComplete: false,
    removeOnFail: false,
  },
})

// Process LinkedIn profile extraction jobs
export const linkedinWorker = new Worker<LinkedInProfileJob, LinkedInProfileJobResult>(
  'linkedin-profile-extract',
  async (job) => {
    const { appUserId, linkedinUrl } = job.data

    try {
      // Fetch profile from LinkdAPI
      const profileData = await fetchLinkedInProfile(linkedinUrl)
      const cvState = mapLinkdAPIToCvState(profileData)

      // Save to UserProfile in database
      const supabase = getSupabaseAdminClient()
      const { error } = await supabase.from('user_profiles').upsert(
        {
          user_id: appUserId,
          cv_state: cvState,
          source: 'linkedin',
          linkedin_url: linkedinUrl,
          extracted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

      if (error) {
        logError('[linkedin-queue-worker] Database upsert failed', {
          appUserId,
          error: error.message,
        })
        throw new Error(`Database upsert failed: ${error.message}`)
      }

      logInfo('[linkedin-queue-worker] Profile extracted successfully', {
        appUserId,
        experiences: cvState.experience.length,
        educations: cvState.education.length,
        skills: cvState.skills.length,
      })

      return {
        success: true,
        appUserId,
        message: 'Profile extracted and saved successfully',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logError('[linkedin-queue-worker] Extraction failed', {
        appUserId,
        linkedinUrl,
        error: errorMessage,
      })
      throw error
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process 2 jobs at a time to respect LinkdAPI rate limits
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
  }
)

// Cleanup listeners
linkedinWorker.on('completed', (job) => {
  logInfo('[linkedin-worker] Job completed', {
    jobId: job.id,
    appUserId: job.data.appUserId,
  })
})

linkedinWorker.on('failed', (job, error) => {
  logError('[linkedin-worker] Job failed', {
    jobId: job?.id,
    appUserId: job?.data.appUserId,
    error: error.message,
    attempt: job?.attemptsMade,
  })
})

linkedinWorker.on('error', (error) => {
  logError('[linkedin-worker] Worker error', {
    error: error.message,
  })
})

/**
 * Cleanup old LinkedIn extraction jobs (>24 hours).
 * Called by the cron endpoint /api/cron/cleanup daily.
 *
 * BullMQ jobs stay in queue indefinitely with removeOnComplete: false,
 * so we need explicit cleanup to prevent unbounded queue growth.
 */
export async function cleanupOldLinkedInJobs(daysOld: number = 1): Promise<number> {
  try {
    const allJobs = await linkedinQueue.getJobs(['completed', 'failed'], 0, -1)
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
    let deletedCount = 0

    for (const job of allJobs) {
      if (job.finishedOn && job.finishedOn < cutoffTime) {
        await job.remove()
        deletedCount++
      }
    }

    logInfo('[linkedin-queue-cleanup] Old jobs removed', {
      deletedCount,
      daysOld,
    })

    return deletedCount
  } catch (error) {
    logError('[linkedin-queue-cleanup] Cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
      daysOld,
    })
    throw error
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await linkedinWorker.close()
  await linkedinQueue.close()
  await redis.disconnect()
})
