export type UserRole = 'admin' | 'rsm' | 'sector_manager'
export type SectorScope = 'all' | 'own_sectors_only'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  region_id: string | null
  sector_scope: SectorScope
  is_active: boolean
}

export interface PipelineStage {
  id: string
  name: string
  display_order: number
  is_won: boolean
  is_lost: boolean
  is_active: boolean
}
