import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Providers } from './providers'
import { Sidebar } from '@/components/shared/Sidebar'
import { MobileNav } from '@/components/shared/MobileNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) {
    // getCurrentUser() returns null when either the auth session is missing OR the
    // users table has no matching row. If the session exists but the row is missing,
    // the proxy will keep redirecting here → /login → back here (loop).
    // Break the loop by signing out so the proxy sees an unauthenticated user.
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar role={user.role} fullName={user.full_name} email={user.email} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile nav (bottom tab bar + sheet) */}
      <div className="md:hidden">
        <MobileNav role={user.role} fullName={user.full_name} email={user.email} />
      </div>
    </Providers>
  )
}
