import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth'
import { PageHeader } from '@/components/shared/PageHeader'
import { OpportunityRegisterForm } from '@/features/opportunities/components/OpportunityRegisterForm'

export default async function NewOpportunityPage() {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) redirect('/login')
  // Sector Managers cannot create opportunities (PRODUCT.md §6) — the "New
  // Opportunity" button is already hidden for them on the list page; this
  // guards against navigating here directly by URL.
  if (profile.role === 'sector_manager') redirect('/opportunities')

  return (
    <div>
      <PageHeader title="New Opportunity" description="Register a new opportunity in the pipeline." />
      <OpportunityRegisterForm profile={profile} />
    </div>
  )
}
