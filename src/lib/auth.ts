import { createClient } from '@/lib/supabase/server'
import type { AppUser, UserRole } from '@/lib/types'

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, role, region_id, sector_scope, is_active')
    .eq('id', user.id)
    .single()

  return data ?? null
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser()
  return user?.role ?? null
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthenticated')
  return user
}

export async function requireRole(...roles: UserRole[]): Promise<AppUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new Error('Forbidden')
  return user
}
