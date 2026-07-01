'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getOpportunityColumns } from '@/features/opportunities/columns'
import { useOpportunities, usePipelineStages, useSectors } from '@/features/opportunities/hooks'
import { CloseDealModal } from './CloseDealModal'
import type { UserRole } from '@/lib/auth'

interface OpportunityListViewProps {
  role: UserRole
}

export function OpportunityListView({ role }: OpportunityListViewProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [stageIds, setStageIds] = useState<string[]>([])
  const [sectorIds, setSectorIds] = useState<string[]>([])
  const [atRiskOnly, setAtRiskOnly] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [closingOpportunityId, setClosingOpportunityId] = useState<string | null>(null)

  const { data: stages = [] } = usePipelineStages()
  const { data: sectors = [] } = useSectors()
  const { data: opportunities = [], isLoading } = useOpportunities({
    includeWonLost: showClosed,
    stageIds: stageIds.length ? stageIds : undefined,
    atRiskOnly: atRiskOnly || undefined,
    sectorIds: sectorIds.length ? sectorIds : undefined,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return opportunities
    return opportunities.filter(
      (o) => o.prospect_company_name.toLowerCase().includes(q) || o.country.toLowerCase().includes(q),
    )
  }, [opportunities, search])

  const columns = useMemo(() => getOpportunityColumns(role, (id) => setClosingOpportunityId(id)), [role])

  const closingOpportunity = closingOpportunityId
    ? (opportunities.find((o) => o.id === closingOpportunityId) ?? null)
    : null

  // Sector Managers have read-only pipeline access — see PRODUCT.md §6
  const canCreate = role !== 'sector_manager'

  return (
    <div className="p-6">
      <PageHeader
        title="Opportunities"
        description="The pipeline of deals currently being pursued."
        actions={
          canCreate && (
            <Link href="/opportunities/new" className={buttonVariants({ variant: 'default' })}>
              New Opportunity
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search company or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <MultiSelectFilter
          label="Stage"
          options={stages.map((s) => ({ id: s.id, label: s.name }))}
          selected={stageIds}
          onChange={setStageIds}
        />
        {/* Sector filter: Admin and Sector Manager only — RSMs don't get it, per ARCHITECTURE.md */}
        {role !== 'rsm' && (
          <MultiSelectFilter
            label="Sector"
            options={sectors.map((s) => ({ id: s.id, label: s.name }))}
            selected={sectorIds}
            onChange={setSectorIds}
          />
        )}
        <button type="button" onClick={() => setAtRiskOnly((v) => !v)}>
          <Badge variant={atRiskOnly ? 'destructive' : 'outline'}>At Risk</Badge>
        </button>
        <button type="button" onClick={() => setShowClosed((v) => !v)}>
          <Badge variant={showClosed ? 'secondary' : 'outline'}>Show closed</Badge>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No opportunities yet.</p>
          {canCreate && (
            <Link href="/opportunities/new" className={buttonVariants({ variant: 'default' })}>
              New Opportunity
            </Link>
          )}
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(row) => router.push(`/opportunities/${row.id}`)} />
      )}

      {closingOpportunity && (
        <CloseDealModal
          opportunity={closingOpportunity}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setClosingOpportunityId(null)
          }}
        />
      )}
    </div>
  )
}
