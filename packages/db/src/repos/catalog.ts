import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../client'
import { withTenant } from '../context'
import {
  businesses,
  type CatalogCategory,
  type CatalogItem,
  catalogCategories,
  catalogItems,
} from '../schema'

export interface CatalogView {
  categories: (CatalogCategory & { items: CatalogItem[] })[]
  uncategorized: CatalogItem[]
}

export async function getBusinessForTenant(tenantId: string, businessId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.tenantId, tenantId)))
      .limit(1)
    return rows[0] ?? null
  })
}

export async function getCatalog(tenantId: string, businessId: string): Promise<CatalogView> {
  return withTenant(tenantId, async (tx) => {
    const categories = await tx
      .select()
      .from(catalogCategories)
      .where(
        and(eq(catalogCategories.tenantId, tenantId), eq(catalogCategories.businessId, businessId)),
      )
      .orderBy(catalogCategories.sortOrder, catalogCategories.name)

    const items = await tx
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.businessId, businessId)))
      .orderBy(catalogItems.sortOrder, catalogItems.name)

    const byCategory = new Map<string, CatalogItem[]>()
    const uncategorized: CatalogItem[] = []
    for (const item of items) {
      if (!item.categoryId) {
        uncategorized.push(item)
        continue
      }
      const bucket = byCategory.get(item.categoryId) ?? []
      bucket.push(item)
      byCategory.set(item.categoryId, bucket)
    }

    return {
      categories: categories.map((category) => ({
        ...category,
        items: byCategory.get(category.id) ?? [],
      })),
      uncategorized,
    }
  })
}

export interface CreateCategoryInput {
  tenantId: string
  businessId: string
  name: string
  sortOrder?: number
}

export async function createCategory(input: CreateCategoryInput): Promise<CatalogCategory> {
  return withTenant(input.tenantId, async (tx) => {
    const rows = await tx
      .insert(catalogCategories)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('category insert returned no row')
    return row
  })
}

export interface UpdateCategoryInput {
  tenantId: string
  businessId: string
  id: string
  name?: string
  sortOrder?: number
  active?: boolean
}

export async function updateCategory(input: UpdateCategoryInput): Promise<CatalogCategory | null> {
  return withTenant(input.tenantId, async (tx) => {
    const rows = await tx
      .update(catalogCategories)
      .set({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.active === undefined ? {} : { active: input.active }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(catalogCategories.id, input.id),
          eq(catalogCategories.tenantId, input.tenantId),
          eq(catalogCategories.businessId, input.businessId),
        ),
      )
      .returning()
    return rows[0] ?? null
  })
}

export async function deleteCategory(
  tenantId: string,
  businessId: string,
  id: string,
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .delete(catalogCategories)
      .where(
        and(
          eq(catalogCategories.id, id),
          eq(catalogCategories.tenantId, tenantId),
          eq(catalogCategories.businessId, businessId),
        ),
      )
      .returning({ id: catalogCategories.id })
    return rows.length > 0
  })
}

export interface CreateItemInput {
  tenantId: string
  businessId: string
  categoryId: string | null
  name: string
  description: string | null
  priceCentavos: number
  unit: string
  available: boolean
  stockCount: number | null
  metadata: Record<string, unknown>
}

export async function createItem(input: CreateItemInput): Promise<CatalogItem> {
  return withTenant(input.tenantId, async (tx) => {
    if (input.categoryId) {
      await assertCategoryBelongs(tx, input.tenantId, input.businessId, input.categoryId)
    }
    const rows = await tx
      .insert(catalogItems)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        priceCentavos: input.priceCentavos,
        unit: input.unit,
        available: input.available,
        stockCount: input.stockCount,
        metadata: input.metadata,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('item insert returned no row')
    return row
  })
}

export interface UpdateItemInput {
  tenantId: string
  businessId: string
  id: string
  categoryId?: string | null
  name?: string
  description?: string | null
  priceCentavos?: number
  unit?: string
  available?: boolean
  stockCount?: number | null
  metadata?: Record<string, unknown>
}

export async function updateItem(input: UpdateItemInput): Promise<CatalogItem | null> {
  return withTenant(input.tenantId, async (tx) => {
    if (input.categoryId) {
      await assertCategoryBelongs(tx, input.tenantId, input.businessId, input.categoryId)
    }
    const rows = await tx
      .update(catalogItems)
      .set({
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.priceCentavos === undefined ? {} : { priceCentavos: input.priceCentavos }),
        ...(input.unit === undefined ? {} : { unit: input.unit }),
        ...(input.available === undefined ? {} : { available: input.available }),
        ...(input.stockCount === undefined ? {} : { stockCount: input.stockCount }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(catalogItems.id, input.id),
          eq(catalogItems.tenantId, input.tenantId),
          eq(catalogItems.businessId, input.businessId),
        ),
      )
      .returning()
    return rows[0] ?? null
  })
}

export async function deleteItem(
  tenantId: string,
  businessId: string,
  id: string,
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .delete(catalogItems)
      .where(
        and(
          eq(catalogItems.id, id),
          eq(catalogItems.tenantId, tenantId),
          eq(catalogItems.businessId, businessId),
        ),
      )
      .returning({ id: catalogItems.id })
    return rows.length > 0
  })
}

async function assertCategoryBelongs(
  tx: Database,
  tenantId: string,
  businessId: string,
  categoryId: string,
): Promise<void> {
  const rows = await tx
    .select({ id: catalogCategories.id })
    .from(catalogCategories)
    .where(
      and(
        eq(catalogCategories.id, categoryId),
        eq(catalogCategories.tenantId, tenantId),
        eq(catalogCategories.businessId, businessId),
      ),
    )
    .limit(1)
  if (rows.length === 0) {
    throw new CategoryNotFoundError()
  }
}

export class CategoryNotFoundError extends Error {
  constructor() {
    super('Category does not belong to this business')
    this.name = 'CategoryNotFoundError'
  }
}

export async function getItemForTenant(
  tenantId: string,
  businessId: string,
  itemId: string,
): Promise<CatalogItem | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.id, itemId),
          eq(catalogItems.tenantId, tenantId),
          eq(catalogItems.businessId, businessId),
        ),
      )
      .limit(1)
    return rows[0] ?? null
  })
}

export async function setItemImage(
  tenantId: string,
  businessId: string,
  itemId: string,
  imageUrl: string | null,
): Promise<CatalogItem | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .update(catalogItems)
      .set({ imageUrl, updatedAt: new Date() })
      .where(
        and(
          eq(catalogItems.id, itemId),
          eq(catalogItems.tenantId, tenantId),
          eq(catalogItems.businessId, businessId),
        ),
      )
      .returning()
    return rows[0] ?? null
  })
}

export async function getItemsByIds(
  tenantId: string,
  businessId: string,
  ids: string[],
): Promise<CatalogItem[]> {
  if (ids.length === 0) return []
  return withTenant(tenantId, (tx) =>
    tx
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.tenantId, tenantId),
          eq(catalogItems.businessId, businessId),
          inArray(catalogItems.id, ids),
        ),
      ),
  )
}
