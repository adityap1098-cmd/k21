import { db } from '../../db/index.js'
import { users } from '../../db/schema/index.js'

// ─── Types ────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  employeeNumber: string
  name: string
  baseSalary: number
  isActive: boolean
  taxStatus: string
}

export interface PayrollRun {
  id: string
  period: string
  status: string
  totalGross: number
  totalNet: number
  employeeCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a default base salary based on user role.
 * Used when no dedicated payroll table exists yet.
 */
function getSalaryByRole(role: string): number {
  const salaries: Record<string, number> = {
    Owner: 15000000,
    Admin: 8000000,
    Finance: 7000000,
    Cashier: 4500000,
    'Warehouse Staff': 4000000,
  }
  return salaries[role] ?? 5000000 // 5M as fallback default
}

/**
 * Generates an employee number from user ID.
 * Format: EMP-[first 8 chars of UUID in uppercase]
 */
function generateEmployeeNumber(userId: string): string {
  return `EMP-${userId.substring(0, 8).toUpperCase()}`
}

// ─── listEmployees ────────────────────────────────────────────────────────

/**
 * Lists all active users as employees with derived salary info.
 * Since there is no dedicated payroll table yet, data is derived from users table.
 */
export async function listEmployees(): Promise<Employee[]> {
  const allUsers = await db.select().from(users)

  return allUsers.map((user) => ({
    id: user.id,
    employeeNumber: generateEmployeeNumber(user.id),
    name: user.email.split('@')[0] ?? user.email, // Use email username as name
    baseSalary: getSalaryByRole(user.role),
    isActive: user.isActive,
    taxStatus: user.isActive ? 'PTKP-TK/0' : 'INACTIVE', // Placeholder tax status
  }))
}

// ─── listPayrollRuns ──────────────────────────────────────────────────────

/**
 * Lists payroll runs.
 * Returns empty array for now (Phase Future feature).
 * In the future, this will query a dedicated payroll_runs table.
 */
export async function listPayrollRuns(
  _filters?: Record<string, unknown>
): Promise<PayrollRun[]> {
  // Placeholder: return empty array
  // Future implementation will query payroll_runs table and aggregate transaction data
  return []
}

// ─── createPayrollRun ─────────────────────────────────────────────────────

/**
 * Creates a new payroll run.
 * Placeholder for Phase Future: currently returns mock data.
 * Will eventually insert into payroll_runs table and calculate deductions.
 */
export async function createPayrollRun(params: {
  period: string
}): Promise<PayrollRun> {
  const { period } = params

  // Placeholder: return mock payroll run
  // Future implementation:
  // 1. Insert into payroll_runs table
  // 2. Calculate gross salary for each active employee
  // 3. Calculate tax (PPh 21) and contributions (BPJS)
  // 4. Return summary with total gross and net
  return {
    id: `RUN-${Date.now()}`,
    period,
    status: 'PENDING',
    totalGross: 0,
    totalNet: 0,
    employeeCount: 0,
  }
}
