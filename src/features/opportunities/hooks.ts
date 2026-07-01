'use client'

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  getOpportunities,
  getOpportunityById,
  getOpportunityProducts,
  getPipelineStages,
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
  stale: ['opportunities', 'stale'] as const,
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

export function useStaleOpportunities() {
  return useQuery({
    queryKey: opportunityKeys.stale,
    queryFn: () => getStaleOpportunities(30),
  })
}

// ── Optimistic update helpers ─────────────────────────────────────────────────
// Cards/tables read opportunities from the LIST query cache (opportunityKeys.lists()),
// not a single detail object — so patching for an optimistic update means mapping
// over every cached list array and replacing the one matching row.

function patchOpportunityInLists(
  queryClient: QueryClient,
  opportunityId: string,
  patch: (opportunity: Opportunity) => Opportunity,
) {
  queryClient.setQueriesData<Opportunity[]>({ queryKey: opportunityKeys.lists() }, (old) =>
    old?.map((opportunity) => (opportunity.id === opportunityId ? patch(opportunity) : opportunity)),
  )
}

function rollbackOpportunityLists(
  queryClient: QueryClient,
  previousLists?: [readonly unknown[], Opportunity[] | undefined][],
) {
  previousLists?.forEach(([key, snapshot]) => queryClient.setQueryData(key, snapshot))
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
      const previousLists = queryClient.getQueriesData<Opportunity[]>({ queryKey: opportunityKeys.lists() })

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

      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      rollbackOpportunityLists(queryClient, context?.previousLists)
    },
    onSuccess: (data, _vars, context) => {
      // Server Actions return { error } for business-rule failures rather than
      // throwing, so a rejected update resolves onSuccess, not onError — the
      // optimistic patch still needs rolling back in that case.
      if ('error' in data && data.error) {
        rollbackOpportunityLists(queryClient, context?.previousLists)
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
      const previousLists = queryClient.getQueriesData<Opportunity[]>({ queryKey: opportunityKeys.lists() })

      patchOpportunityInLists(queryClient, vars.opportunityId, (opportunity) =>
        vars.field === 'next_step'
          ? { ...opportunity, next_step: vars.value }
          : { ...opportunity, is_at_risk: vars.value },
      )

      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      rollbackOpportunityLists(queryClient, context?.previousLists)
    },
    onSuccess: (data, _vars, context) => {
      if ('error' in data && data.error) {
        rollbackOpportunityLists(queryClient, context?.previousLists)
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
