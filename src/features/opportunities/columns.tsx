'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import type { Opportunity } from './types'
import type { UserRole } from '@/lib/auth'
import { InlineStageCell } from '@/components/shared/InlineStageCell'
import { InlineTextareaCell } from '@/components/shared/InlineTextareaCell'
import { cn } from '@/lib/utils'

// Format currency with locale
function formatValue(value: number | null, currency: string | null): string {
  if (value == null || !currency) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

// Relative time with stale indicator
function LastActivityCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground italic text-xs">No activity</span>

  const date = new Date(value)
  const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
  const label = formatDistanceToNow(date, { addSuffix: true })

  return (
    <span className={cn('text-xs', daysAgo > 30 ? 'text-destructive font-medium' : 'text-muted-foreground')}>
      {label}
    </span>
  )
}

// Base columns — visible to all roles
function getBaseColumns(
  onWonSelected?: (opportunityId: string) => void,
): ColumnDef<Opportunity>[] {
  return [
    {
      accessorKey: 'prospect_company_name',
      header: 'Company',
      cell: ({ row }) => (
        <span className="font-medium text-sm">{row.original.prospect_company_name}</span>
      ),
    },
    {
      accessorKey: 'country',
      header: 'Country',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      cell: ({ row }) => {
        const stage = row.original.stage
        if (!stage) return null
        return (
          <InlineStageCell
            opportunityId={row.original.id}
            stageId={row.original.stage_id}
            stageName={stage.name}
            isWon={stage.is_won}
            isLost={stage.is_lost}
            onWonSelected={onWonSelected}
          />
        )
      },
    },
    {
      id: 'estimated_value',
      header: 'Value',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatValue(row.original.estimated_value, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'next_step',
      header: 'Next Step',
      size: 280,
      cell: ({ row }) => (
        <InlineTextareaCell
          opportunityId={row.original.id}
          field="next_step"
          value={row.original.next_step}
        />
      ),
    },
    {
      id: 'last_activity_at',
      header: 'Last Activity',
      cell: ({ row }) => <LastActivityCell value={row.original.last_activity_at} />,
    },
  ]
}

// Admin-only additional columns
const adminColumns: ColumnDef<Opportunity>[] = [
  {
    id: 'rsm',
    header: 'RSM',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.rsm?.full_name ?? '—'}</span>
    ),
  },
  {
    id: 'region',
    header: 'Region',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.region?.name ?? '—'}</span>
    ),
  },
]

/**
 * Factory function: returns the right columns for the given role.
 * The DataTable and InlineStageCell have no knowledge of roles.
 *
 * @param onWonSelected - callback fired when user clicks Won stage; caller opens Close Deal modal
 */
export function getOpportunityColumns(
  role: UserRole,
  onWonSelected?: (opportunityId: string) => void,
): ColumnDef<Opportunity>[] {
  const base = getBaseColumns(onWonSelected)

  if (role === 'admin') {
    return [...base, ...adminColumns]
  }

  // sector_manager gets read-only view — no inline-editable cells
  if (role === 'sector_manager') {
    return base.map((col) => {
      // Replace inline-editable next_step with a plain display
      if (col.id === 'next_step' || (col as { accessorKey?: string }).accessorKey === 'next_step') {
        return {
          ...col,
          cell: ({ row }: { row: { original: Opportunity } }) => (
            <span className="text-xs text-muted-foreground truncate max-w-[280px] block">
              {row.original.next_step ?? '—'}
            </span>
          ),
        } as ColumnDef<Opportunity>
      }
      return col
    })
  }

  // RSM — full inline editing, no RSM/Region columns
  return base
}
