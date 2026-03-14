// @k21/shared — shared DTOs, request schemas, and domain types
// Phase 0: empty stub. Each subsequent phase adds types here.

export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
}
