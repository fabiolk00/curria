import { asaas } from '@/lib/asaas/client'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'

type GetOrCreateCustomerInput = {
  appUserId: string
  name: string
  email?: string | null
  cpfCnpj?: string
}

export async function getOrCreateCustomer({
  appUserId,
  name,
  email,
  cpfCnpj,
}: GetOrCreateCustomerInput): Promise<string> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('user_quotas')
    .select('asaas_customer_id')
    .eq('user_id', appUserId)
    .single()

  if (data?.asaas_customer_id) return data.asaas_customer_id as string

  const customer = await asaas.post<{ id: string }>('/customers', {
    name,
    externalReference: appUserId,
    ...(email ? { email } : {}),
    ...(cpfCnpj ? { cpfCnpj } : {}),
  })

  await supabase
    .from('user_quotas')
    .upsert({
      user_id: appUserId,
      asaas_customer_id: customer.id,
      ...createUpdatedAtTimestamp(),
    }, { onConflict: 'user_id' })

  return customer.id
}
