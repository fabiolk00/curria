import 'server-only'

import { cookies } from 'next/headers'

import { getUserBillingMetadata } from '@/lib/asaas/quota'
import {
  E2E_AUTH_COOKIE_NAME,
  verifySignedE2EAuthCookie,
} from '@/lib/auth/e2e-auth'

import {
  resolveAiChatAccessFromBillingMetadata,
  type AiChatAccessDecision,
} from '@/lib/billing/ai-chat-access'

const E2E_AI_CHAT_ACCESS_OVERRIDE: AiChatAccessDecision = {
  allowed: true,
  feature: 'ai_chat',
  reason: 'active_pro',
  plan: 'pro',
  status: 'active',
  renewsAt: null,
  asaasSubscriptionId: 'e2e_auth_bypass',
}

async function resolveE2EAiChatAccessOverride(
  appUserId: string,
): Promise<AiChatAccessDecision | null> {
  let cookieValue: string | undefined

  try {
    cookieValue = cookies().get(E2E_AUTH_COOKIE_NAME)?.value
  } catch {
    return null
  }

  const payload = await verifySignedE2EAuthCookie(cookieValue)
  if (!payload || payload.appUserId !== appUserId) {
    return null
  }

  return E2E_AI_CHAT_ACCESS_OVERRIDE
}

export async function getAiChatAccess(
  appUserId: string,
  options?: { now?: Date },
): Promise<AiChatAccessDecision> {
  const e2eOverride = await resolveE2EAiChatAccessOverride(appUserId)
  if (e2eOverride) {
    return e2eOverride
  }

  try {
    const metadata = await getUserBillingMetadata(appUserId)
    return resolveAiChatAccessFromBillingMetadata(metadata, {
      now: options?.now,
    })
  } catch {
    return resolveAiChatAccessFromBillingMetadata(null, {
      billingMetadataUnavailable: true,
      now: options?.now,
    })
  }
}
