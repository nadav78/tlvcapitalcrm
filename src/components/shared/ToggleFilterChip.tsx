'use client'

import { Badge } from '@/components/ui/badge'

interface ToggleFilterChipProps {
  label: string
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  activeVariant?: 'destructive' | 'secondary'
}

// Shared boolean filter chip (e.g. At Risk, Show closed) — a Badge-styled
// toggle button with proper aria-pressed semantics, so list pages don't each
// re-implement the same button+Badge wrapper.
export function ToggleFilterChip({ label, pressed, onPressedChange, activeVariant = 'secondary' }: ToggleFilterChipProps) {
  return (
    <button type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)}>
      <Badge variant={pressed ? activeVariant : 'outline'}>{label}</Badge>
    </button>
  )
}
