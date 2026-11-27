'use client'

import type { ThemeManifest, ThemeTokens } from '@iskina/contracts'
import {
  bestOnColor,
  buildThemeManifest,
  contrastRatio,
  DEFAULT_PRESET_ID,
  validateThemeManifest,
} from '@iskina/core'
import { useMemo, useState } from 'react'

type Editable = { primary: string; accent: string; surface: string; onSurface: string }

interface PresetProp {
  id: string
  label: string
  layout: 'grid' | 'list' | 'compact'
  tokens: { light: ThemeTokens; dark: ThemeTokens }
}

function editable(tokens: ThemeTokens): Editable {
  return {
    primary: tokens.primary,
    accent: tokens.accent,
    surface: tokens.surface,
    onSurface: tokens.onSurface,
  }
}

function ColourRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <code className="font-mono text-xs text-[var(--muted-text)]">{value}</code>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 cursor-pointer rounded border border-[var(--outline)] bg-transparent"
        />
      </span>
    </label>
  )
}

export function ThemeEditor({
  businessId,
  businessName,
  presets,
  initial,
}: {
  businessId: string
  businessName: string
  presets: PresetProp[]
  initial: { version: number; manifest: ThemeManifest; publishedAt: string } | null
}) {
  const start = initial?.manifest ?? buildThemeManifest({ presetId: DEFAULT_PRESET_ID }, 1)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [layout, setLayout] = useState<'grid' | 'list' | 'compact'>(
    initial?.manifest.layout ?? 'grid',
  )
  const [light, setLight] = useState<Editable>(editable(start.tokens.light))
  const [dark, setDark] = useState<Editable>(editable(start.tokens.dark))
  const [logo, setLogo] = useState(initial?.manifest.assets?.logo ?? '')
  const [banner, setBanner] = useState(initial?.manifest.assets?.banner ?? '')
  const [version, setVersion] = useState(initial?.version ?? null)
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function choosePreset(preset: PresetProp) {
    setPresetId(preset.id)
    setLayout(preset.layout)
    setLight(editable(preset.tokens.light))
    setDark(editable(preset.tokens.dark))
    setError(null)
    setMessage(null)
  }

  const preview = useMemo(() => {
    try {
      return buildThemeManifest(
        {
          presetId,
          layout,
          light,
          dark,
          assets: { logo: logo || null, banner: banner || null },
        },
        1,
      )
    } catch {
      return null
    }
  }, [presetId, layout, light, dark, logo, banner])

  const issues = useMemo(() => (preview ? validateThemeManifest(preview).issues : []), [preview])
  const valid = preview !== null && issues.length === 0
  const tokens = preview?.tokens.light ?? start.tokens.light

  async function publish() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/v1/merchant/theme/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessId,
          presetId,
          layout,
          light,
          dark,
          assets: { logo: logo || null, banner: banner || null },
        }),
      })
      const data = (await response.json()) as {
        theme?: { version: number; manifest: ThemeManifest; publishedAt: string }
        error?: { message?: string }
      }
      if (!response.ok || !data.theme) {
        setError(data.error?.message ?? 'Could not publish the theme')
        return
      }
      setVersion(data.theme.version)
      setPublishedAt(data.theme.publishedAt)
      setMessage(`Published version ${data.theme.version}`)
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Preset</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => choosePreset(preset)}
                className={`rounded-xl border p-3 text-left ${
                  presetId === preset.id ? 'border-[var(--primary)]' : 'border-[var(--outline)]'
                }`}
              >
                <span className="flex gap-1">
                  {[
                    preset.tokens.light.primary,
                    preset.tokens.light.accent,
                    preset.tokens.light.surface,
                  ].map((colour) => (
                    <span
                      key={colour}
                      className="size-5 rounded-full border border-black/10"
                      style={{ background: colour }}
                    />
                  ))}
                </span>
                <span className="mt-2 block text-sm font-medium">{preset.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Light tokens</h2>
            <span className="text-xs text-[var(--muted-text)]">button text auto-picked for AA</span>
          </div>
          <div className="mt-4 space-y-3">
            <ColourRow
              label="Primary"
              value={light.primary}
              onChange={(value) => setLight((current) => ({ ...current, primary: value }))}
            />
            <ColourRow
              label="Accent"
              value={light.accent}
              onChange={(value) => setLight((current) => ({ ...current, accent: value }))}
            />
            <ColourRow
              label="Surface"
              value={light.surface}
              onChange={(value) => setLight((current) => ({ ...current, surface: value }))}
            />
            <ColourRow
              label="Text"
              value={light.onSurface}
              onChange={(value) => setLight((current) => ({ ...current, onSurface: value }))}
            />
          </div>
          <p className="mt-3 font-mono text-xs text-[var(--muted-text)]">
            text/primary {contrastRatio(bestOnColor(light.primary), light.primary).toFixed(2)}:1 ·
            text/surface {contrastRatio(light.onSurface, light.surface).toFixed(2)}:1
          </p>
        </section>

        <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Dark tokens</h2>
          <div className="mt-4 space-y-3">
            <ColourRow
              label="Primary"
              value={dark.primary}
              onChange={(value) => setDark((current) => ({ ...current, primary: value }))}
            />
            <ColourRow
              label="Accent"
              value={dark.accent}
              onChange={(value) => setDark((current) => ({ ...current, accent: value }))}
            />
            <ColourRow
              label="Surface"
              value={dark.surface}
              onChange={(value) => setDark((current) => ({ ...current, surface: value }))}
            />
            <ColourRow
              label="Text"
              value={dark.onSurface}
              onChange={(value) => setDark((current) => ({ ...current, onSurface: value }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Layout and assets</h2>
          <div className="mt-4 grid gap-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Layout</span>
              <select
                value={layout}
                onChange={(event) => setLayout(event.target.value as 'grid' | 'list' | 'compact')}
                className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2"
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block">Logo URL</span>
              <input
                value={logo}
                onChange={(event) => setLogo(event.target.value)}
                placeholder="https://…/logo.png"
                className="w-full rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block">Banner URL</span>
              <input
                value={banner}
                onChange={(event) => setBanner(event.target.value)}
                placeholder="https://…/banner.jpg"
                className="w-full rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--outline)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Live preview</h2>
            <span className="text-xs text-[var(--muted-text)]">
              {version ? `published v${version}` : 'using default preset'}
            </span>
          </div>

          <div
            className="mt-3 overflow-hidden rounded-xl border"
            style={{
              background: tokens.surface,
              color: tokens.onSurface,
              borderColor: tokens.outline,
            }}
          >
            <div style={{ background: tokens.primary, color: tokens.onPrimary }} className="p-4">
              <p className="text-xs uppercase tracking-wide opacity-80">{businessName}</p>
              <p className="mt-1 text-lg font-bold">Tonight&apos;s menu</p>
            </div>
            <div className="space-y-3 p-4">
              {['Chicken adobo', 'Lechon kawali', "Sago't gulaman"].map((name, index) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{name}</span>
                  <span className="text-sm font-mono">
                    ₱{index === 2 ? '45' : index === 0 ? '120' : '150'}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: tokens.primary, color: tokens.onPrimary }}
              >
                Order now
              </button>
            </div>
          </div>

          <div
            className="mt-3 rounded-xl border p-4"
            style={{
              background: (preview ?? start).tokens.dark.surface,
              color: (preview ?? start).tokens.dark.onSurface,
              borderColor: (preview ?? start).tokens.dark.outline,
            }}
          >
            <p className="text-xs uppercase tracking-wide opacity-70">Dark mode</p>
            <button
              type="button"
              className="mt-2 rounded-lg px-3 py-2 text-sm font-semibold"
              style={{
                background: (preview ?? start).tokens.dark.primary,
                color: (preview ?? start).tokens.dark.onPrimary,
              }}
            >
              Order now
            </button>
          </div>
        </section>

        {issues.length > 0 ? (
          <section className="rounded-2xl border border-[var(--danger)] p-4 text-sm text-[var(--danger)]">
            <h2 className="font-semibold">Fix before publishing</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {issues.slice(0, 6).map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm font-medium text-[var(--success)]">{message}</p> : null}

        <button
          type="button"
          onClick={() => void publish()}
          disabled={busy || !valid}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          {busy ? 'Publishing…' : version ? 'Publish new version' : 'Publish theme'}
        </button>
        <p className="text-xs text-[var(--muted-text)]">
          {publishedAt ? `Last published ${new Date(publishedAt).toLocaleString()}. ` : ''}
          Published versions are immutable; HATOD reads the latest one.
        </p>
      </div>
    </div>
  )
}
