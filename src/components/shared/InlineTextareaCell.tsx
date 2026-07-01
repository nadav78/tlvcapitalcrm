'use client'

import { useState, useRef } from 'react'
import { useUpdateOpportunityField } from '@/features/opportunities/hooks'

interface InlineTextareaCellProps {
  opportunityId: string
  field: 'next_step'
  value: string | null
}

export function InlineTextareaCell({ opportunityId, field, value }: InlineTextareaCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  const { mutate: updateField, isPending } = useUpdateOpportunityField()

  function startEdit() {
    setDraft(value ?? '')
    setEditing(true)
    // Focus on next tick after render
    setTimeout(() => ref.current?.focus(), 0)
  }

  function save() {
    setEditing(false)
    if (draft !== (value ?? '')) {
      updateField({ opportunityId, field, value: draft })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      save()
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setDraft(value ?? '')
    }
  }

  // Stop propagation: this cell renders inside table rows that may have their
  // own onRowClick handler (see DataTable) — without this, starting an edit
  // (or clicking inside the textarea) also navigates away via the row click.
  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        rows={3}
        disabled={isPending}
        className="w-full min-w-[200px] rounded border border-ring bg-background px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
      className="w-full text-left text-sm truncate max-w-[280px] text-muted-foreground hover:text-foreground transition-colors"
      title={value ?? undefined}
    >
      {value || <span className="italic opacity-50">Add next step…</span>}
    </button>
  )
}
