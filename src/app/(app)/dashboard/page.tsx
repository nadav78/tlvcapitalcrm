import { getUserProfile } from '@/lib/auth'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function DashboardPage() {
  const profile = await getUserProfile()

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${profile?.full_name ?? 'there'}`}
      />
      {/* Dashboard content implemented in a later session */}
    </div>
  )
}
