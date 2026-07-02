'use client'

import { useState } from 'react'
import { useUpdateOpportunityStage, usePipelineStages } from '@/features/opportunities/hooks'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Shared by the interactive trigger below and the read-only stage badge in
// features/opportunities/columns.tsx (Sector Manager view) — read-only means
// not clickable, not less scannable, so both render the same colors.
export function stageBadgeClasses(isWon: boolean, isLost: boolean): string {
  return cn(
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
    isWon && 'bg-green-50 text-green-700 border-green-200',
    isLost && 'bg-red-50 text-red-700 border-red-200',
    !isWon && !isLost && 'bg-blue-50 text-blue-700 border-blue-200',
  )
}

interface InlineStageCellProps {
  opportunityId: string
  stageId: string
  stageName: string
  isWon: boolean
  isLost: boolean
  onWonSelected?: (opportunityId: string) => void
}

export function InlineStageCell({
  opportunityId,
  stageId,
  stageName,
  isWon,
  isLost,
  onWonSelected,
}: InlineStageCellProps) {
  const [open, setOpen] = useState(false)
  const [pendingStage, setPendingStage] = useState<{ id: string; name: string } | null>(null)
  const { data: stages = [] } = usePipelineStages()
  const { mutate: updateStage, isPending } = useUpdateOpportunityStage()

  function handleStageSelect(targetStage: { id: string; name: string; is_won: boolean; is_lost: boolean }) {
    if (targetStage.id === stageId) {
      setOpen(false)
      return
    }

    setOpen(false)

    if (targetStage.is_won) {
      onWonSelected?.(opportunityId)
      return
    }

    // Confirm when re-staging away from a terminal state (Won/Lost)
    if (isWon || isLost) {
      setPendingStage(targetStage)
      return
    }

    updateStage({ opportunityId, stageId: targetStage.id })
  }

  function confirmReStage() {
    if (pendingStage) {
      updateStage({ opportunityId, stageId: pendingStage.id })
      setPendingStage(null)
    }
  }

  return (
    // Stop propagation: this cell renders inside table rows that may have
    // their own onRowClick handler (see DataTable) — without this, opening
    // the stage popover also navigates away via the row click.
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={isPending}
          className={cn(stageBadgeClasses(isWon, isLost), 'transition-colors')}
        >
          {stageName}
          <span className="text-[10px] opacity-60">▾</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto min-w-[180px] p-1">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => handleStageSelect(stage)}
              className={cn(
                'flex w-full items-center gap-2 text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted',
                stage.id === stageId && 'font-medium text-primary',
              )}
            >
              {/* Fixed-width slot so names stay aligned whether checked or not */}
              <span className="flex w-4 shrink-0 items-center justify-center">
                {stage.id === stageId && <Check className="size-3.5" />}
              </span>
              {stage.name}
              {/* Marks which stage triggers the Win flow when an Admin has
                  renamed it to something that no longer says so itself */}
              {stage.is_won && !/won/i.test(stage.name) && (
                <span className="ml-1 text-xs text-green-600">(Won)</span>
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={!!pendingStage}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingStage(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isWon ? 'Reopen opportunity?' : 'Re-stage opportunity?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isWon
                ? `Reopening this opportunity will return it to "${pendingStage?.name}". The existing Client record and Contract will not be removed — they remain linked. Contract terms can only be edited by an Admin.`
                : `Returning this opportunity to "${pendingStage?.name}". All existing data is preserved.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={confirmReStage}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
