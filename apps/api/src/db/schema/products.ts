import { pgTable, uuid, varchar, boolean, integer, numeric, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { categories } from './categories.js'

export const ppnEnum = pgEnum('ppn_type', ['TAXABLE', 'NON_TAXABLE'])

export const products = pgTable('products', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }),
  categoryId:  uuid('category_id').notNull().references(() => categories.id),
  ppnType:     ppnEnum('ppn_type').notNull().default('TAXABLE'),
  isActive:    boolean('is_active').notNull().default(true),
  createdBy:   uuid('created_by').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const productVariants = pgTable('product_variants', {
  id:                uuid('id').primaryKey().defaultRandom(),
  productId:         uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku:               varchar('sku', { length: 100 }).notNull().unique(),
  barcode:           varchar('barcode', { length: 100 }).unique(),
  attributes:        jsonb('attributes').notNull().default({}),
  price:             numeric('price', { precision: 15, scale: 2 }).notNull(),
  costPrice:         numeric('cost_price', { precision: 15, scale: 2 }).notNull(),
  stockQty:          integer('stock_qty').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type VariantAttributes = Record<string, string>
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type ProductVariant = typeof productVariants.$inferSelect
export type NewProductVariant = typeof productVariants.$inferInsert
