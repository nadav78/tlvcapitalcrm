import { stageBadgeClasses } from '@/components/shared/InlineStageCell'
import { Badge } from '@/components/ui/badge'
import { formatValue, LastActivityCell } from '@/features/opportunities/columns'
import type { Opportunity } from '@/features/opportunities/types'

interface OpportunityCardProps {
  opportunity: Opportunity
  onClick: () => void
}

// Mobile (< md) replacement for a table row — the desktop table is 889px
// wide and unusable at 375px (docs/UI-PLAN.md item 1). Reuses the same
// formatting helpers as the desktop columns (formatValue, stageBadgeClasses,
// LastActivityCell) so the two views never drift. Inline editing stays
// desktop-only for this first pass — tapping a card navigates to the detail
// page, same as a desktop row click.
export function OpportunityCard({ opportunity, onClick }: OpportunityCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-sm" title={opportunity.prospect_company_name}>
          {opportunity.prospect_company_name}
        </span>
        {opportunity.is_at_risk && (
          <Badge variant="destructive" className="shrink-0">
            At risk
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {opportunity.stage ? (
          <span className={stageBadgeClasses(opportunity.stage.is_won, opportunity.stage.is_lost)}>
            {opportunity.stage.name}
          </span>
        ) : (
          <span />
        )}
        <span className="text-sm font-medium tabular-nums">
          {formatValue(opportunity.estimated_value, opportunity.currency)}
        </span>
      </div>

      <LastActivityCell value={opportunity.last_activity_at} />
    </button>
  )
}
