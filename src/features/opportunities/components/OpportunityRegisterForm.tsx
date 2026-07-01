'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { opportunityRegisterSchema, type OpportunityRegisterValues } from '@/features/opportunities/schemas'
import {
  useCreateOpportunity,
  usePipelineStages,
  useSectors,
  useAdvisors,
  useRsmUsers,
} from '@/features/opportunities/hooks'
import { LEAD_SOURCE_LABELS, ORG_TYPE_LABELS } from '@/lib/constants'
import type { UserProfile } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface OpportunityRegisterFormProps {
  profile: UserProfile
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'fieldErrors' in error) {
    const flat = error as { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
    const messages = [...flat.formErrors, ...Object.values(flat.fieldErrors).flatMap((m) => m ?? [])]
    return messages.join(' ') || 'Please check the form and try again.'
  }
  return 'Something went wrong. Please try again.'
}

export function OpportunityRegisterForm({ profile }: OpportunityRegisterFormProps) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: stages = [] } = usePipelineStages()
  const { data: sectors = [] } = useSectors()
  const { data: advisors = [] } = useAdvisors()
  const { data: rsmUsers = [] } = useRsmUsers(profile.role === 'admin')
  const createOpportunity = useCreateOpportunity()
  const isPending = createOpportunity.isPending

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<OpportunityRegisterValues>({
    resolver: zodResolver(opportunityRegisterSchema),
    defaultValues: {
      rsm_id: profile.role === 'rsm' ? profile.id : '',
      region_id: profile.role === 'rsm' ? (profile.region_id ?? '') : '',
      stage_id: '',
      registration_date: today,
      lead_source: undefined,
      sector_id: undefined,
      prospect_organization_type: null,
      advisor_id: null,
    },
  })

  // Defaults to the default stage (pipeline_stages.is_default) — this is not a
  // field the RSM chooses at registration (PRODUCT.md §4.1: "Stage (defaults to
  // New)"). Matched via the boolean flag, not the stage name, since Admins can
  // rename stages (PRODUCT.md §4.6) — same reasoning as is_won/is_lost. Set
  // once the stage list loads, since it isn't available on the form's first render.
  const defaultStageId = stages.find((s) => s.is_default)?.id
  useEffect(() => {
    if (defaultStageId) setValue('stage_id', defaultStageId)
  }, [defaultStageId, setValue])

  const rsmId = useWatch({ control, name: 'rsm_id' })

  function handleRsmChange(rsmId: string | null) {
    setValue('rsm_id', rsmId ?? '', { shouldValidate: true })
    const selectedRsm = rsmUsers.find((r) => r.id === rsmId)
    setValue('region_id', selectedRsm?.region_id ?? '', { shouldValidate: true })
  }

  function onSubmit(values: OpportunityRegisterValues) {
    setFormError(null)
    createOpportunity.mutate(values, {
      onSuccess: (result) => {
        if ('error' in result) {
          setFormError(errorMessage(result.error))
          return
        }
        toast.success('Opportunity created.')
        router.push('/opportunities')
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    })
  }

  const stagesReady = !!defaultStageId
  const rsmsReady = profile.role !== 'admin' || !!rsmId

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {formError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      {profile.role === 'admin' && (
        <div className="space-y-1.5">
          <Label htmlFor="rsm_id">RSM (Account Manager)</Label>
          <Controller
            name="rsm_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value || null} onValueChange={handleRsmChange} disabled={isPending}>
                <SelectTrigger id="rsm_id" className="w-full">
                  <SelectValue placeholder="Select RSM" />
                </SelectTrigger>
                <SelectContent>
                  {rsmUsers.map((rsm) => (
                    <SelectItem key={rsm.id} value={rsm.id}>
                      {rsm.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.rsm_id && <p className="text-xs text-destructive">{errors.rsm_id.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prospect_company_name">Prospect company name</Label>
          <Input id="prospect_company_name" disabled={isPending} {...register('prospect_company_name')} />
          {errors.prospect_company_name && (
            <p className="text-xs text-destructive">{errors.prospect_company_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" disabled={isPending} {...register('country')} />
          {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="requirement_type">Requirement type</Label>
          <Input
            id="requirement_type"
            placeholder="e.g. C-UAS, Optronics, Maritime ISR"
            disabled={isPending}
            {...register('requirement_type')}
          />
          {errors.requirement_type && (
            <p className="text-xs text-destructive">{errors.requirement_type.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sector_id">Sector</Label>
          <Controller
            name="sector_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? null} onValueChange={field.onChange} disabled={isPending}>
                <SelectTrigger id="sector_id" className="w-full">
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.sector_id && <p className="text-xs text-destructive">{errors.sector_id.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of the client's requirement"
          disabled={isPending}
          {...register('description')}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lead_source">Lead source</Label>
          <Controller
            name="lead_source"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? null} onValueChange={field.onChange} disabled={isPending}>
                <SelectTrigger id="lead_source" className="w-full">
                  <SelectValue placeholder="Select lead source" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.lead_source && <p className="text-xs text-destructive">{errors.lead_source.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="registration_date">Registration date</Label>
          <Input id="registration_date" type="date" disabled={isPending} {...register('registration_date')} />
          {errors.registration_date && (
            <p className="text-xs text-destructive">{errors.registration_date.message}</p>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="text-sm font-medium text-foreground">Prospect contact</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fill in what you know now — the rest can be added later from the opportunity.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prospect_organization_type">Organization type</Label>
            <Controller
              name="prospect_organization_type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? null}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={isPending}
                >
                  <SelectTrigger id="prospect_organization_type" className="w-full">
                    <SelectValue placeholder="Select organization type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="advisor_id">Advisor support</Label>
            <Controller
              name="advisor_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? null}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={isPending}
                >
                  <SelectTrigger id="advisor_id" className="w-full">
                    <SelectValue placeholder="Select advisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {advisors.map((advisor) => (
                      <SelectItem key={advisor.id} value={advisor.id}>
                        {advisor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prospect_contact_name">Contact name</Label>
            <Input id="prospect_contact_name" disabled={isPending} {...register('prospect_contact_name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prospect_website">Website</Label>
            <Input
              id="prospect_website"
              placeholder="https://"
              disabled={isPending}
              {...register('prospect_website')}
            />
            {errors.prospect_website && (
              <p className="text-xs text-destructive">{errors.prospect_website.message}</p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prospect_contact_email">Contact email</Label>
            <Input
              id="prospect_contact_email"
              type="email"
              disabled={isPending}
              {...register('prospect_contact_email')}
            />
            {errors.prospect_contact_email && (
              <p className="text-xs text-destructive">{errors.prospect_contact_email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prospect_contact_phone">Contact phone</Label>
            <Input id="prospect_contact_phone" disabled={isPending} {...register('prospect_contact_phone')} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-6">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => router.push('/opportunities')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !stagesReady || !rsmsReady}>
          {isPending && <Loader2 className="animate-spin" />}
          Create Opportunity
        </Button>
      </div>
    </form>
  )
}
