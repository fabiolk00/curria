import { getUserBillingInfo } from '@/lib/asaas/quota'
import { logWarn, serializeError } from '@/lib/observability/structured-log'

export const OPTIONAL_BILLING_INFO_NOTICE =
  'Não foi possível carregar seus créditos e plano agora. Atualize a página em instantes. O restante do workspace continua disponível.'

type BillingInfoSurface = 'auth_layout' | 'dashboard_page' | 'chat_page' | 'settings_page'

export async function loadOptionalBillingInfo(
  appUserId: string,
  surface: BillingInfoSurface,
): Promise<{
  billingInfo: Awaited<ReturnType<typeof getUserBillingInfo>>
  billingNotice: string | null
}> {
  if (process.env.E2E_SKIP_OPTIONAL_BILLING_INFO === 'true') {
    return {
      billingInfo: null,
      billingNotice: null,
    }
  }

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
