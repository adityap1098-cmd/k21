import { db } from '../../db/index.js'
import { users, payrollEmployees } from '../../db/schema/index.js'
import type { PayrollEmployee } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'

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
 * Lists employees — merges users table with payroll_employees.
 * Payroll employees take priority; users without payroll records are derived.
 */
export async function listEmployees(): Promise<Employee[]> {
  // Fetch payroll employees first
  const payrollRows = await db.select().from(payrollEmployees).where(eq(payrollEmployees.isActive, true))

  // Fetch all active users for fallback
  const allUsers = await db.select().from(users)

  // Build set of user IDs that have payroll records
  const payrollUserIds = new Set(payrollRows.filter(p => p.userId).map(p => p.userId!))

  // Payroll employees
  const fromPayroll: Employee[] = payrollRows.map((p) => ({
    id: p.id,
    employeeNumber: generateEmployeeNumber(p.id),
    name: p.nama,
    baseSalary: p.gajiPokok,
    isActive: p.isActive,
    taxStatus: 'PTKP-TK/0',
  }))

  // Users without payroll records (fallback derived data)
  const fromUsers: Employee[] = allUsers
    .filter(u => !payrollUserIds.has(u.id))
    .map((user) => ({
      id: user.id,
      employeeNumber: generateEmployeeNumber(user.id),
      name: user.name || user.email.split('@')[0] || user.email,
      baseSalary: getSalaryByRole(user.role),
      isActive: user.isActive,
      taxStatus: user.isActive ? 'PTKP-TK/0' : 'INACTIVE',
    }))

  return [...fromPayroll, ...fromUsers]
}

/**
 * C-15: Creates a payroll employee record.
 */
export async function createEmployee(params: {
  nama: string
  jabatan: string
  gajiPokok: number
  tunjangan: number
}): Promise<PayrollEmployee> {
  const [employee] = await db
    .insert(payrollEmployees)
    .values({
      nama: params.nama,
      jabatan: params.jabatan,
      gajiPokok: params.gajiPokok,
      tunjangan: params.tunjangan,
    })
    .returning()

  return employee
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
