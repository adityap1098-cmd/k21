/**
 * void.service.ts — Transaction void operations.
 *
 * voidTransaction is implemented in pos.service.ts alongside completeSale and
 * syncOfflineTx because all three share the same DB/schema imports and are
 * tested together in pos.test.ts.  This file re-exports it so consumers can
 * import from either location.
 */
export { voidTransaction } from './pos.service.js'
