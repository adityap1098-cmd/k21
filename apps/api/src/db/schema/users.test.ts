import { describe, it, expect } from 'vitest'

describe('roleEnum', () => {
  it('contains exactly the 5 expected role values', async () => {
    const { roleEnum } = await import('./users.js')
    expect(roleEnum.enumValues).toEqual([
      'Owner',
      'Finance',
      'Warehouse Staff',
      'Cashier',
      'Admin',
    ])
  })
})
