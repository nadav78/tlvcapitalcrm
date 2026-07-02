'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ToggleFilterChipProps {
  label: string
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  activeVariant?: 'destructive' | 'secondary'
}

// Shared boolean filter chip (e.g. At Risk, Show closed) with aria-pressed
// semantics, so list pages don't each re-implement the same toggle. Rendered
// as a size=sm Button to sit at the same height as the MultiSelectFilter
// buttons beside it, with a leading check when active so the pressed state is
// unmistakable regardless of variant color.
export function ToggleFilterChip({ label, pressed, onPressedChange, activeVariant = 'secondary' }: ToggleFilterChipProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? activeVariant : 'outline'}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
    >
      {pressed && <Check />}
      {label}
    </Button>
  )
}
