import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/dashboard-shell'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  return <DashboardShell>{children}</DashboardShell>
}
