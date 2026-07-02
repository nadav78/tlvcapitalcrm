'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { closeDealSchema, type CloseDealValues } from '@/features/opportunities/schemas'
import { useCloseOpportunity, useCloseDealPreview } from '@/features/opportunities/hooks'
import type { Opportunity } from '@/features/opportunities/types'
import { CURRENCIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CloseDealModalProps {
  opportunity: Opportunity
  open: boolean
  onOpenChange: (open: boolean) => void
}

// closeOpportunity returns { error: string } for business-rule failures and
// { error: ZodFlattenedError } if server-side re-validation somehow catches
// something the client schema didn't (shouldn't happen on the golden path,
// but the type allows it).
function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'fieldErrors' in error) {
    const flat = error as { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
    const messages = [...flat.formErrors, ...Object.values(flat.fieldErrors).flatMap((m) => m ?? [])]
    return messages.join(' ') || 'Please check the form and try again.'
  }
  return 'Something went wrong. Please try again.'
}

export function CloseDealModal({ opportunity, open, onOpenChange }: CloseDealModalProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const { data: preview, isLoading: previewLoading } = useCloseDealPreview(opportunity)
  const closeDeal = useCloseOpportunity()
  const isPending = closeDeal.isPending

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CloseDealValues>({
    resolver: zodResolver(closeDealSchema),
    defaultValues: {
      contract_value: opportunity.estimated_value ?? undefined,
      currency: opportunity.currency ?? undefined,
      // (currency stays undefined here for RHF's "untouched" semantics; the
      // Select below coerces to null at the JSX call site per the Base UI
      // convention in ARCHITECTURE.md — a value that goes undefined → string
      // trips React's uncontrolled-to-controlled warning)
      signed_date: '',
      expected_delivery_date: '',
    },
  })

  function onSubmit(values: CloseDealValues) {
    setFormError(null)
    closeDeal.mutate(
      { opportunityId: opportunity.id, input: values },
      {
        onSuccess: (result) => {
          if ('error' in result) {
            setFormError(errorMessage(result.error))
            return
          }
          toast.success(`Deal closed. ${opportunity.prospect_company_name} is now a Client.`)
          onOpenChange(false)
        },
        onError: () => setFormError('Something went wrong. Please try again.'),
      },
    )
  }

  const previewClientName = preview?.existingClient?.name ?? opportunity.prospect_company_name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close deal: {opportunity.prospect_company_name}</DialogTitle>
          <DialogDescription>
            Marking this opportunity as Won creates a Client and Contract record.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}

        <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {previewLoading ? (
            <p>Checking client and contact records…</p>
          ) : (
            <>
              <p>
                {preview?.existingClient ? (
                  <>Linking to existing client: <span className="font-medium text-foreground">{previewClientName}</span></>
                ) : (
                  <>Creating new client: <span className="font-medium text-foreground">{previewClientName}</span></>
                )}
              </p>
              {preview && preview.preWinContacts.length > 0 && (
                <p>
                  Linking {preview.preWinContacts.length} contact{preview.preWinContacts.length > 1 ? 's' : ''} to{' '}
                  {previewClientName}
                </p>
              )}
              {preview?.willCreateContact && opportunity.prospect_contact_name && (
                <p>Creating contact: {opportunity.prospect_contact_name}</p>
              )}
            </>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract_value">Contract value</Label>
              <Input
                id="contract_value"
                type="number"
                step="0.01"
                disabled={isPending}
                {...register('contract_value', { valueAsNumber: true })}
              />
              {errors.contract_value && (
                <p className="text-xs text-destructive">{errors.contract_value.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? null} onValueChange={field.onChange} disabled={isPending}>
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signed_date">Signed date</Label>
              <Input id="signed_date" type="date" disabled={isPending} {...register('signed_date')} />
              {errors.signed_date && <p className="text-xs text-destructive">{errors.signed_date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expected_delivery_date">Expected delivery date</Label>
              <Input
                id="expected_delivery_date"
                type="date"
                disabled={isPending}
                {...register('expected_delivery_date')}
              />
              {errors.expected_delivery_date && (
                <p className="text-xs text-destructive">{errors.expected_delivery_date.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Close Deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
