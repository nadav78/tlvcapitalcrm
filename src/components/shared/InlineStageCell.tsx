'use client'

import { useState } from 'react'
import { useUpdateOpportunityStage, usePipelineStages } from '@/features/opportunities/hooks'
import { cn } from '@/lib/utils'
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
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
            isWon && 'bg-green-50 text-green-700 border-green-200',
            isLost && 'bg-red-50 text-red-700 border-red-200',
            !isWon && !isLost && 'bg-blue-50 text-blue-700 border-blue-200',
          )}
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
                'w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted',
                stage.id === stageId && 'font-medium text-primary',
              )}
            >
              {stage.name}
              {stage.is_won && <span className="ml-2 text-xs text-green-600">(Won)</span>}
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
