'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
    onSuccess: (_, { opportunityId }) => {
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
    onSuccess: (_, { opportunityId }) => {
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
