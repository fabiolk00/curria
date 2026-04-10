import { getUserBillingInfo } from '@/lib/asaas/quota'
import { logWarn, serializeError } from '@/lib/observability/structured-log'

export const OPTIONAL_BILLING_INFO_NOTICE =
  'Nao foi possivel carregar seus creditos e plano agora. Atualize a pagina em instantes. O restante do workspace continua disponivel.'

type BillingInfoSurface = 'auth_layout' | 'dashboard_page' | 'settings_page'

export async function loadOptionalBillingInfo(
  appUserId: string,
  surface: BillingInfoSurface,
): Promise<{
  billingInfo: Awaited<ReturnType<typeof getUserBillingInfo>>
  billingNotice: string | null
}> {
  try {
    return {
      billingInfo: await getUserBillingInfo(appUserId),
      billingNotice: null,
    }
  } catch (error) {
    logWarn('billing.info.load_failed', {
      appUserId,
      surface,
      success: false,
      ...serializeError(error),
    })

    return {
      billingInfo: null,
      billingNotice: OPTIONAL_BILLING_INFO_NOTICE,
    }
  }
}
