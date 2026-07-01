'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query'
import {
  getOpportunities,
  getOpportunityById,
  getOpportunityProducts,
  getPipelineStages,
  getSectors,
  getCloseDealPreview,
  getStaleOpportunities,
} from './api'
import {
  createOpportunity,
  updateOpportunity,
  updateOpportunityStage,
  updateOpportunityField,
  closeOpportunity,
  reassignOpportunity,
} from './actions'
import type { OpportunityRegisterValues, OpportunityValues, CloseDealValues } from './schemas'
import type { Opportunity, PipelineStage } from './types'

// ── Query keys ────────────────────────────────────────────────────────────────

export const opportunityKeys = {
  all: ['opportunities'] as const,
  lists: () => [...opportunityKeys.all, 'list'] as const,
  list: (filters: object) => [...opportunityKeys.lists(), filters] as const,
  detail: (id: string) => [...opportunityKeys.all, 'detail', id] as const,
  products: (id: string) => [...opportunityKeys.all, 'products', id] as const,
  stages: ['pipeline_stages'] as const,
  sectors: ['sectors'] as const,
  stale: ['opportunities', 'stale'] as const,
  closeDealPreview: (opportunityId: string) => ['opportunities', 'close-deal-preview', opportunityId] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useOpportunities(options?: {
  includeWonLost?: boolean
  stageIds?: string[]
  atRiskOnly?: boolean
  sectorIds?: string[]
}) {
  return useQuery({
    queryKey: opportunityKeys.list(options ?? {}),
    queryFn: () => getOpportunities(options),
    placeholderData: keepPreviousData,
  })
}

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: opportunityKeys.detail(id),
    queryFn: () => getOpportunityById(id),
    enabled: !!id,
  })
}

export function useOpportunityProducts(opportunityId: string) {
  return useQuery({
    queryKey: opportunityKeys.products(opportunityId),
    queryFn: () => getOpportunityProducts(opportunityId),
    enabled: !!opportunityId,
  })
}

export function usePipelineStages() {
  return useQuery({
    queryKey: opportunityKeys.stages,
    queryFn: getPipelineStages,
    staleTime: 5 * 60 * 1000, // Stages rarely change — 5-minute cache
  })
}

export function useSectors(enabled = true) {
  return useQuery({
    queryKey: opportunityKeys.sectors,
    queryFn: getSectors,
    staleTime: 5 * 60 * 1000, // Sectors rarely change — 5-minute cache
    enabled,
  })
}

export function useStaleOpportunities() {
  return useQuery({
    queryKey: opportunityKeys.stale,
    queryFn: () => getStaleOpportunities(30),
  })
}

// Best-effort preview for the Close Deal modal — see getCloseDealPreview.
// The Close Deal modal only ever mounts with a concrete opportunity (it's a
// required prop on CloseDealModal), so this takes a required Opportunity
// rather than modeling a null case no caller uses.
export function useCloseDealPreview(opportunity: Opportunity) {
  return useQuery({
    queryKey: opportunityKeys.closeDealPreview(opportunity.id),
    queryFn: () => getCloseDealPreview(opportunity),
  })
}

// ── Optimistic update helpers ─────────────────────────────────────────────────
// Cards/tables read opportunities from the LIST query cache (opportunityKeys.lists()),
// not a single detail object — so patching for an optimistic update means mapping
// over every cached list array and replacing the one matching row.
//
// Rollback restores only the field(s) this mutation itself changed — applied on
// top of whatever the cache currently looks like — rather than replacing the
// whole cached array with a pre-mutation snapshot. Two inline cells on the same
// row (stage, next_step) are independent mutations with independent isPending
// flags, so they can be in flight at the same time; a whole-array snapshot
// restore from one mutation's rollback would stomp the other mutation's
// optimistic patch if it landed in between.

function patchOpportunityInLists(
  queryClient: QueryClient,
  opportunityId: string,
  patch: (opportunity: Opportunity) => Opportunity,
) {
  queryClient.setQueriesData<Opportunity[]>({ queryKey: opportunityKeys.lists() }, (old) =>
    old?.map((opportunity) => (opportunity.id === opportunityId ? patch(opportunity) : opportunity)),
  )
}

function findOpportunityInLists(queryClient: QueryClient, opportunityId: string): Opportunity | undefined {
  const lists = queryClient.getQueriesData<Opportunity[]>({ queryKey: opportunityKeys.lists() })
  for (const [, data] of lists) {
    const match = data?.find((opportunity) => opportunity.id === opportunityId)
    if (match) return match
  }
  return undefined
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OpportunityRegisterValues) => createOpportunity(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: opportunityKeys.all }),
  })
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OpportunityValues }) =>
      updateOpportunity(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() })
    },
  })
}

export function useUpdateOpportunityStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ opportunityId, stageId }: { opportunityId: string; stageId: string }) =>
      updateOpportunityStage(opportunityId, stageId),
    onMutate: async ({ opportunityId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: opportunityKeys.lists() })
      const previous = findOpportunityInLists(queryClient, opportunityId)

      const stages = queryClient.getQueryData<PipelineStage[]>(opportunityKeys.stages)
      const targetStage = stages?.find((s) => s.id === stageId)

      patchOpportunityInLists(queryClient, opportunityId, (opportunity) => ({
        ...opportunity,
        stage_id: stageId,
        stage: targetStage
          ? {
              id: targetStage.id,
              name: targetStage.name,
              is_won: targetStage.is_won,
              is_lost: targetStage.is_lost,
              display_order: targetStage.display_order,
            }
          : opportunity.stage,
      }))

      return previous ? { previousStageId: previous.stage_id, previousStage: previous.stage } : undefined
    },
    onError: (_err, { opportunityId }, context) => {
      if (!context) return
      patchOpportunityInLists(queryClient, opportunityId, (opportunity) => ({
        ...opportunity,
        stage_id: context.previousStageId,
        stage: context.previousStage,
      }))
    },
    onSuccess: (data, { opportunityId }, context) => {
      // Server Actions return { error } for business-rule failures rather than
      // throwing, so a rejected update resolves onSuccess, not onError — the
      // optimistic patch still needs rolling back in that case.
      if ('error' in data && data.error && context) {
        patchOpportunityInLists(queryClient, opportunityId, (opportunity) => ({
          ...opportunity,
          stage_id: context.previousStageId,
          stage: context.previousStage,
        }))
      }
    },
    onSettled: (_data, _err, { opportunityId }) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(opportunityId) })
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() })
    },
  })
}

export function useUpdateOpportunityField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      input:
        | { opportunityId: string; field: 'next_step'; value: string }
        | { opportunityId: string; field: 'is_at_risk'; value: boolean },
    ) => updateOpportunityField(input),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: opportunityKeys.lists() })
      const previous = findOpportunityInLists(queryClient, vars.opportunityId)

      patchOpportunityInLists(queryClient, vars.opportunityId, (opportunity) =>
        vars.field === 'next_step'
          ? { ...opportunity, next_step: vars.value }
          : { ...opportunity, is_at_risk: vars.value },
      )

      return previous
        ? { previousNextStep: previous.next_step, previousIsAtRisk: previous.is_at_risk }
        : undefined
    },
    onError: (_err, vars, context) => {
      if (!context) return
      patchOpportunityInLists(queryClient, vars.opportunityId, (opportunity) =>
        vars.field === 'next_step'
          ? { ...opportunity, next_step: context.previousNextStep }
          : { ...opportunity, is_at_risk: context.previousIsAtRisk },
      )
    },
    onSuccess: (data, vars, context) => {
      if ('error' in data && data.error && context) {
        patchOpportunityInLists(queryClient, vars.opportunityId, (opportunity) =>
          vars.field === 'next_step'
            ? { ...opportunity, next_step: context.previousNextStep }
            : { ...opportunity, is_at_risk: context.previousIsAtRisk },
        )
      }
    },
    onSettled: (_data, _err, { opportunityId }) => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.detail(opportunityId) })
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() })
    },
  })
}

export function useCloseOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ opportunityId, input }: { opportunityId: string; input: CloseDealValues }) =>
      closeOpportunity(opportunityId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: opportunityKeys.all })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}

export function useReassignOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ opportunityId, newRsmId }: { opportunityId: string; newRsmId: string }) =>
      reassignOpportunity(opportunityId, newRsmId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: opportunityKeys.all }),
  })
}
