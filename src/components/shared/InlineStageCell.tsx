'use client'

import { useState } from 'react'
import { useUpdateOpportunityStage, usePipelineStages } from '@/features/opportunities/hooks'
import { cn } from '@/lib/utils'

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
  const { data: stages = [] } = usePipelineStages()
  const { mutate: updateStage, isPending } = useUpdateOpportunityStage()

  function handleStageSelect(targetStage: { id: string; name: string; is_won: boolean; is_lost: boolean }) {
    if (targetStage.id === stageId) {
      setOpen(false)
      return
    }

    if (targetStage.is_won) {
      setOpen(false)
      onWonSelected?.(opportunityId)
      return
    }

    updateStage({ opportunityId, stageId: targetStage.id })
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
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
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-lg border border-border bg-popover shadow-md py-1">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => handleStageSelect(stage)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted',
                  stage.id === stageId && 'font-medium text-primary',
                )}
              >
                {stage.name}
                {stage.is_won && <span className="ml-2 text-xs text-green-600">(Won)</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
