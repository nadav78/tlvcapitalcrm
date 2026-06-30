import { getCurrentUser } from '@/lib/auth'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.full_name ?? 'there'}.`}
      />
      <div className="px-6 py-8">
        <p className="text-sm text-muted-foreground">Dashboard coming soon.</p>
      </div>
    </div>
  )
}
