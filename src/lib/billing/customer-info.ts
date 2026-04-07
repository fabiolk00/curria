import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { z } from 'zod'

import {
  isValidBrazilStateCode,
  isValidBrazilPhoneNumberInput,
  isValidPostalCodeInput,
  normalizePhoneNumber,
  normalizePostalCode,
  normalizeProvince,
} from '@/lib/billing/address'
import { createDatabaseId } from '@/lib/db/ids'
import { createUpdatedAtTimestamp, currentTimestamp } from '@/lib/db/timestamps'

export const BillingInfoSchema = z.object({
  cpfCnpj: z.string().min(1, 'CPF/CNPJ is required'),
  phoneNumber: z.string()
    .trim()
    .refine(isValidBrazilPhoneNumberInput, 'Phone number must have 10 or 11 digits')
    .transform(normalizePhoneNumber),
  address: z.string().min(1, 'Address is required'),
  addressNumber: z.string().min(1, 'Address number is required'),
  postalCode: z.string()
    .trim()
    .refine(isValidPostalCodeInput, 'Postal code must have 8 digits')
    .transform(normalizePostalCode),
  province: z.string()
    .trim()
    .transform(normalizeProvince)
    .refine(isValidBrazilStateCode, 'Province must be a valid state code'),
})

export type BillingInfo = z.infer<typeof BillingInfoSchema>

export async function saveBillingInfo(
  appUserId: string,
  info: BillingInfo,
): Promise<void> {
  const parsedInfo = BillingInfoSchema.parse(info)
  const supabase = getSupabaseAdminClient()
  const now = currentTimestamp()

  const { error } = await supabase.from('customer_billing_info').upsert(
    {
      id: createDatabaseId(),
      user_id: appUserId,
      cpf_cnpj: parsedInfo.cpfCnpj,
      phone_number: parsedInfo.phoneNumber,
      address: parsedInfo.address,
      address_number: parsedInfo.addressNumber,
      postal_code: parsedInfo.postalCode,
      province: parsedInfo.province,
      ...createUpdatedAtTimestamp(now),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}

export async function getBillingInfo(appUserId: string): Promise<BillingInfo | null> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('customer_billing_info')
    .select('*')
    .eq('user_id', appUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw error
  }

  return {
    cpfCnpj: data.cpf_cnpj,
    phoneNumber: data.phone_number,
    address: data.address,
    addressNumber: data.address_number,
    postalCode: data.postal_code,
    province: data.province,
  }
}
