import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OpportunityListView } from '@/features/opportunities/components/OpportunityListView'

export default async function OpportunitiesPage() {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) redirect('/login')

  // For sector managers, fetch their assigned sector IDs so the list can
  // sort their sectors to the top. Irrelevant for other roles (empty array).
  let userSectorIds: string[] = []
  if (profile.role === 'sector_manager') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('user_sectors')
      .select('sector_id')
      .eq('user_id', profile.id)
    userSectorIds = data?.map((row) => row.sector_id) ?? []
  }

  return <OpportunityListView role={profile.role} userSectorIds={userSectorIds} />
}
