'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/lib/types'

interface InlineStageCellProps {
  currentStage: PipelineStage
  stages: PipelineStage[]
  onStageChange: (stageId: string) => void
  disabled?: boolean
}

function stageVariant(stage: PipelineStage): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (stage.is_won) return 'default'
  if (stage.is_lost) return 'destructive'
  return 'secondary'
}

export function InlineStageCell({
  currentStage,
  stages,
  onStageChange,
  disabled = false,
}: InlineStageCellProps) {
  const [open, setOpen] = useState(false)
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const activeStages = stages.filter((s) => s.is_active || s.id === currentStage.id)

  const handleSelect = (stage: PipelineStage) => {
    if (stage.id === currentStage.id) {
      setOpen(false)
      return
    }

    setOpen(false)

    // Confirm when re-staging from a terminal state
    if (currentStage.is_won || currentStage.is_lost) {
      setPendingStage(stage)
      setConfirmOpen(true)
      return
    }

    onStageChange(stage.id)
  }

  const confirmReStage = () => {
    if (pendingStage) {
      onStageChange(pendingStage.id)
      setPendingStage(null)
    }
    setConfirmOpen(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            'flex items-center gap-1 rounded focus:outline-none focus:ring-2 focus:ring-ring',
            disabled && 'cursor-default'
          )}
        >
          <Badge variant={stageVariant(currentStage)}>{currentStage.name}</Badge>
          {!disabled && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>No stages found.</CommandEmpty>
              <CommandGroup>
                {activeStages
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((stage) => (
                    <CommandItem
                      key={stage.id}
                      onSelect={() => handleSelect(stage)}
                      className="cursor-pointer"
                      data-checked={stage.id === currentStage.id}
                    >
                      {stage.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Confirmation dialog for re-staging from Won or Lost */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentStage.is_won ? 'Reopen opportunity?' : 'Re-stage opportunity?'}
            </DialogTitle>
            <DialogDescription>
              {currentStage.is_won
                ? `Reopening this opportunity will return it to "${pendingStage?.name}". The existing Client record and Contract will not be removed — they remain linked. Contract terms can only be edited by an Admin.`
                : `Returning this opportunity to "${pendingStage?.name}". All existing data is preserved.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReStage}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
