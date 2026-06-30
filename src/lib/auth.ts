import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'rsm' | 'sector_manager'
export type SectorScope = 'all' | 'own_sectors_only'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  region_id: string | null
  is_active: boolean
  sector_scope: SectorScope
}

export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, role, region_id, is_active, sector_scope')
    .eq('id', user.id)
    .single()

  return data as UserProfile | null
}

export async function requireAuth(): Promise<UserProfile> {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) {
    throw new Error('Unauthorized')
  }
  return profile
}
