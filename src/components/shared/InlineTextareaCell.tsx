'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface InlineTextareaCellProps {
  value: string | null
  onSave: (value: string) => Promise<void> | void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function InlineTextareaCell({
  value,
  onSave,
  placeholder = 'Click to add…',
  disabled = false,
  className,
}: InlineTextareaCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const startEditing = () => {
    if (disabled) return
    setDraft(value ?? '')
    setIsEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const save = useCallback(async () => {
    setIsEditing(false)
    const trimmed = draft.trim()
    if (trimmed === (value ?? '').trim()) return
    setIsSaving(true)
    try {
      await onSave(trimmed)
    } finally {
      setIsSaving(false)
    }
  }, [draft, value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setDraft(value ?? '')
      setIsEditing(false)
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      save()
    }
  }

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        rows={3}
        className={cn(
          'w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
          className
        )}
      />
    )
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={startEditing}
      onKeyDown={(e) => e.key === 'Enter' && startEditing()}
      className={cn(
        'min-h-[2rem] cursor-text rounded px-2 py-1.5 text-sm transition-colors',
        disabled ? 'opacity-50 cursor-default' : 'hover:bg-neutral-50',
        isSaving && 'opacity-60',
        !value && 'text-muted-foreground',
        className
      )}
    >
      {value || placeholder}
    </div>
  )
}
