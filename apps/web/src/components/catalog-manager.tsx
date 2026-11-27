'use client'

import { useCallback, useMemo, useState } from 'react'

interface Item {
  id: string
  categoryId: string | null
  name: string
  description: string | null
  priceCentavos: number
  unit: string
  imageUrl: string | null
  available: boolean
  stockCount: number | null
}

interface Category {
  id: string
  name: string
  sortOrder: number
  active: boolean
  items: Item[]
}

interface CatalogResponse {
  categories: Category[]
  uncategorized: Item[]
  error?: { message?: string }
}

const UNITS = ['piece', 'plate', 'order', 'kg', 'liter', 'tank', 'service', 'hour', 'sack']

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

function toCentavos(value: string): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

export function CatalogManager({
  businessId,
  initial,
  canEdit,
}: {
  businessId: string
  initial: { categories: Category[]; uncategorized: Item[] }
  canEdit: boolean
}) {
  const [categories, setCategories] = useState(initial.categories)
  const [uncategorized, setUncategorized] = useState(initial.uncategorized)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [categoryName, setCategoryName] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemUnit, setItemUnit] = useState('piece')
  const [itemCategory, setItemCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editUnit, setEditUnit] = useState('piece')

  const allItems = useMemo(
    () => [...categories.flatMap((category) => category.items), ...uncategorized],
    [categories, uncategorized],
  )

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/v1/catalog?businessId=${encodeURIComponent(businessId)}`)
    const data = (await response.json()) as CatalogResponse
    if (!response.ok) {
      setError(data.error?.message ?? 'Could not load the catalog')
      return
    }
    setCategories(data.categories ?? [])
    setUncategorized(data.uncategorized ?? [])
    setError(null)
  }, [businessId])

  async function run(action: () => Promise<Response>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const response = await action()
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } }
        setError(data.error?.message ?? 'The change was not saved')
        return false
      }
      await refresh()
      return true
    } catch {
      setError('Could not reach the server')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault()
    if (!categoryName.trim()) return
    const ok = await run(() =>
      fetch('/api/v1/catalog/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessId, name: categoryName }),
      }),
    )
    if (ok) setCategoryName('')
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault()
    const priceCentavos = toCentavos(itemPrice)
    if (priceCentavos === null) {
      setError('Enter a valid price')
      return
    }
    const ok = await run(() =>
      fetch('/api/v1/catalog/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessId,
          name: itemName,
          priceCentavos,
          unit: itemUnit,
          categoryId: itemCategory || null,
        }),
      }),
    )
    if (ok) {
      setItemName('')
      setItemPrice('')
    }
  }

  async function toggleAvailable(item: Item) {
    await run(() =>
      fetch(`/api/v1/catalog/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessId, available: !item.available }),
      }),
    )
  }

  async function removeItem(item: Item) {
    if (!window.confirm(`Remove ${item.name}?`)) return
    await run(() =>
      fetch(`/api/v1/catalog/items/${item.id}?businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
      }),
    )
  }

  async function uploadImage(item: Item, file: File) {
    const form = new FormData()
    form.append('businessId', businessId)
    form.append('file', file)
    await run(() =>
      fetch(`/api/v1/catalog/items/${item.id}/image`, {
        method: 'POST',
        body: form,
      }),
    )
  }

  async function removeImage(item: Item) {
    if (!window.confirm(`Remove the photo for ${item.name}?`)) return
    await run(() =>
      fetch(`/api/v1/catalog/items/${item.id}/image?businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
      }),
    )
  }

  async function removeCategory(category: Category) {
    if (
      !window.confirm(
        `Remove ${category.name}? Its ${category.items.length} item(s) become uncategorized.`,
      )
    ) {
      return
    }
    await run(() =>
      fetch(
        `/api/v1/catalog/categories/${category.id}?businessId=${encodeURIComponent(businessId)}`,
        { method: 'DELETE' },
      ),
    )
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditPrice((item.priceCentavos / 100).toFixed(2))
    setEditUnit(item.unit)
  }

  async function saveEdit(item: Item) {
    const priceCentavos = toCentavos(editPrice)
    if (priceCentavos === null) {
      setError('Enter a valid price')
      return
    }
    const ok = await run(() =>
      fetch(`/api/v1/catalog/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessId, name: editName, priceCentavos, unit: editUnit }),
      }),
    )
    if (ok) setEditingId(null)
  }

  function renderItem(item: Item) {
    if (editingId === item.id) {
      return (
        <li key={item.id} className="rounded-xl border border-[var(--primary)] p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto_auto] sm:items-center">
            <input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
            <input
              value={editPrice}
              onChange={(event) => setEditPrice(event.target.value)}
              inputMode="decimal"
              className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
            <select
              value={editUnit}
              onChange={(event) => setEditUnit(event.target.value)}
              className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            >
              {UNITS.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveEdit(item)}
              className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-[var(--outline)] px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </li>
      )
    }

    return (
      <li
        key={item.id}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--outline)] px-3 py-2.5"
      >
        <span className="size-11 shrink-0 overflow-hidden rounded-lg border border-[var(--outline)] bg-[var(--surface-muted)]">
          {item.imageUrl ? (
            <span
              role="img"
              aria-label={item.name}
              className="block h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${item.imageUrl})` }}
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-[10px] text-[var(--muted-text)]">
              no img
            </span>
          )}
        </span>
        <span className="flex-1 text-sm font-medium">{item.name}</span>
        <span className="font-mono text-sm">{peso.format(item.priceCentavos / 100)}</span>
        <span className="text-xs text-[var(--muted-text)]">/{item.unit}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.available
              ? 'bg-[var(--success)] text-white'
              : 'bg-[var(--surface-muted)] text-[var(--muted-text)]'
          }`}
        >
          {item.available ? 'available' : 'hidden'}
        </span>
        {canEdit ? (
          <span className="flex flex-wrap gap-1.5">
            <label className="cursor-pointer rounded border border-[var(--outline)] px-2 py-1 text-xs">
              {item.imageUrl ? 'Replace photo' : 'Add photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadImage(item, file)
                  event.target.value = ''
                }}
              />
            </label>
            {item.imageUrl ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeImage(item)}
                className="rounded border border-[var(--outline)] px-2 py-1 text-xs"
              >
                Remove photo
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleAvailable(item)}
              className="rounded border border-[var(--outline)] px-2 py-1 text-xs"
            >
              {item.available ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              onClick={() => startEdit(item)}
              className="rounded border border-[var(--outline)] px-2 py-1 text-xs"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeItem(item)}
              className="rounded border border-[var(--outline)] px-2 py-1 text-xs text-[var(--danger)]"
            >
              Delete
            </button>
          </span>
        ) : null}
      </li>
    )
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <section className="grid gap-4 md:grid-cols-2">
          <form
            onSubmit={addCategory}
            className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5"
          >
            <h2 className="font-semibold">Add category</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Rice meals"
                className="flex-1 rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)]"
              >
                Add
              </button>
            </div>
          </form>

          <form
            onSubmit={addItem}
            className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5"
          >
            <h2 className="font-semibold">Add item</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                required
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Chicken adobo"
                className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <input
                required
                value={itemPrice}
                onChange={(event) => setItemPrice(event.target.value)}
                placeholder="Price in pesos"
                inputMode="decimal"
                className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <select
                value={itemCategory}
                onChange={(event) => setItemCategory(event.target.value)}
                className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={itemUnit}
                onChange={(event) => setItemUnit(event.target.value)}
                className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)]"
            >
              Add item
            </button>
          </form>
        </section>
      ) : null}

      <section className="space-y-6">
        {categories.map((category) => (
          <article
            key={category.id}
            className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{category.name}</h2>
                <p className="text-xs text-[var(--muted-text)]">{category.items.length} item(s)</p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeCategory(category)}
                  className="text-xs text-[var(--danger)] underline-offset-4 hover:underline"
                >
                  Delete category
                </button>
              ) : null}
            </div>
            <ul className="mt-4 space-y-2">
              {category.items.length === 0 ? (
                <li className="text-sm text-[var(--muted-text)]">No items yet.</li>
              ) : (
                category.items.map(renderItem)
              )}
            </ul>
          </article>
        ))}

        <article className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Uncategorized</h2>
          <ul className="mt-4 space-y-2">
            {uncategorized.length === 0 ? (
              <li className="text-sm text-[var(--muted-text)]">Nothing here.</li>
            ) : (
              uncategorized.map(renderItem)
            )}
          </ul>
        </article>
      </section>

      <p className="text-xs text-[var(--muted-text)]">
        {allItems.length} item(s) total. Prices are stored as integer centavos.
      </p>
    </div>
  )
}
