import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth'
import { OpportunityListView } from '@/features/opportunities/components/OpportunityListView'

export default async function OpportunitiesPage() {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) redirect('/login')

  return <OpportunityListView role={profile.role} />
}
