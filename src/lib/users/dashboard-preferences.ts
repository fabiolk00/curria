import { getSupabaseAdminClient } from "@/lib/db/supabase-admin"

type DashboardWelcomeGuidePreferenceRow = {
  dashboard_welcome_guide_seen: boolean | null
}

export async function getDashboardWelcomeGuideSeen(appUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("users")
    .select("dashboard_welcome_guide_seen")
    .eq("id", appUserId)
    .maybeSingle<DashboardWelcomeGuidePreferenceRow>()

  if (error) {
    throw new Error(`Failed to load dashboard preferences: ${error.message}`)
  }

  return data?.dashboard_welcome_guide_seen ?? false
}

export async function setDashboardWelcomeGuideSeen(
  appUserId: string,
  seen: boolean,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("users")
    .update({
      dashboard_welcome_guide_seen: seen,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appUserId)
    .select("dashboard_welcome_guide_seen")
    .single<DashboardWelcomeGuidePreferenceRow>()

  if (error || !data) {
    throw new Error(`Failed to save dashboard preferences: ${error?.message ?? "Unknown error"}`)
  }

  return data.dashboard_welcome_guide_seen ?? false
}
