import { create } from 'zustand'

export interface ActiveShift {
  id: string
  cashierId: string
  openingFloat: number
  openedAt: string  // ISO string
}

interface ShiftState {
  activeShift: ActiveShift | null
  setActiveShift: (shift: ActiveShift | null) => void
}

export const useShiftStore = create<ShiftState>((set) => ({
  activeShift: null,
  setActiveShift: (shift) => set({ activeShift: shift }),
}))
