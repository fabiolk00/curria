'use server'

import { redirect } from 'next/navigation'

export async function createSession() {
  redirect('/dashboard')
}
