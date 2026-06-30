import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth'
import { QueryProvider } from '@/components/shared/QueryProvider'
import { Sidebar, MobileTabBar } from '@/components/shared/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getUserProfile()

  if (!profile || !profile.is_active) {
    redirect('/login')
  }

  return (
    <QueryProvider>
      <div className="flex min-h-screen">
        <Sidebar role={profile.role} />

        <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </QueryProvider>
  )
}
