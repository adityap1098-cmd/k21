import type { ErrorRequestHandler } from 'express'

/**
 * Known business error codes thrown by service layer.
 * Maps to appropriate HTTP status code and safe client message.
 */
const KNOWN_ERRORS: Record<string, { status: number; message: string }> = {
  // Auth
  INVALID_CREDENTIALS:       { status: 401, message: 'Invalid email or password' },
  INVALID_CURRENT_PASSWORD:  { status: 401, message: 'Current password is incorrect' },
  PASSWORD_CHANGE_REQUIRED:  { status: 403, message: 'Password change required' },
  PASSWORD_TOO_SHORT:        { status: 400, message: 'Password must be at least 8 characters' },
  PASSWORD_MUST_DIFFER:      { status: 400, message: 'New password must be different from current password' },

  // Resources
  USER_NOT_FOUND:            { status: 404, message: 'User not found' },
  TRANSACTION_NOT_FOUND:     { status: 404, message: 'Transaction not found' },
  SERVICE_ORDER_NOT_FOUND:   { status: 404, message: 'Service order not found' },
  VEHICLE_NOT_FOUND:         { status: 404, message: 'Vehicle not found' },
  CUSTOMER_NOT_FOUND:        { status: 404, message: 'Customer not found' },
  PRODUCT_NOT_FOUND:         { status: 404, message: 'Product not found' },
  VARIANT_NOT_FOUND:         { status: 404, message: 'Product variant not found' },
  CATEGORY_NOT_FOUND:        { status: 404, message: 'Category not found' },
  SHIFT_NOT_FOUND:           { status: 404, message: 'Shift not found' },
  PO_NOT_FOUND:              { status: 404, message: 'Purchase order not found' },
  SERVICE_ITEM_NOT_FOUND:    { status: 404, message: 'Service item not found' },

  // Conflict / business rule
  ALREADY_VOIDED:            { status: 409, message: 'Transaction is already voided' },
  INSUFFICIENT_STOCK:        { status: 409, message: 'Insufficient stock for one or more items' },
  SHIFT_NOT_OPEN:            { status: 409, message: 'No open shift found. Please open a shift first.' },
  SHIFT_ALREADY_CLOSED:      { status: 409, message: 'Shift is already closed' },
  DUPLICATE_EMAIL:           { status: 409, message: 'Email already in use' },
  DUPLICATE_PLATE:           { status: 409, message: 'Vehicle plate already registered' },
  DUPLICATE_SKU:             { status: 409, message: 'SKU already exists' },
  DUPLICATE_BARCODE:         { status: 409, message: 'Barcode already exists' },

  // Validation / business logic
  REASON_REQUIRED:           { status: 400, message: 'Reason is required for adjustments' },
  APPROVER_REQUIRED:         { status: 400, message: 'ApprovedBy is required for adjustments' },
  OVERPAYMENT:               { status: 422, message: 'Payment amount exceeds remaining balance' },
  ORDER_NOT_COMPLETED:       { status: 422, message: 'Order must be completed before accepting payment' },
  ORDER_NOT_IN_PROGRESS:     { status: 422, message: 'Order is not in progress' },
  INVALID_STATUS_TRANSITION: { status: 422, message: 'Invalid status transition' },
  CANNOT_DELETE_COMPLETED:   { status: 422, message: 'Cannot delete a completed order with payments' },
  GRANDCHILD_NOT_ALLOWED:    { status: 422, message: 'Cannot create a category more than 2 levels deep' },
}

/**
 * Resolves an error to a safe HTTP status + message pair.
 *
 * Priority:
 * 1. Known business error code → mapped status + safe message
 * 2. Unknown error → 500 + generic message (never leaks internals)
 */
export function resolveError(err: unknown): { status: number; message: string } {
  if (err instanceof Error) {
    const known = KNOWN_ERRORS[err.message]
    if (known) return known
  }
  return { status: 500, message: 'Internal server error' }
}

/**
 * Express global error handler middleware.
 *
 * Catches any error thrown or passed via next(err) from route handlers.
 * Logs 5xx errors to console, returns consistent JSON shape.
 *
 * Mount AFTER all routes:
 *   app.use(globalErrorHandler)
 */
export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, message } = resolveError(err)

  // Log server errors for debugging (never log 4xx — those are expected)
  if (status >= 500) {
    console.error(`[API ERROR ${status}]`, err)
  }

  res.status(status).json({
    success: false,
    data: null,
    error: message,
  })
}
