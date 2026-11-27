import type { ThemeLayout, ThemeTokens } from '@iskina/contracts'

export interface ThemePreset {
  id: string
  label: string
  layout: ThemeLayout
  tokens: { light: ThemeTokens; dark: ThemeTokens }
}

/**
 * Rosso — the default. Ferrari-style racing red with white button text, a
 * Giallo accent and near-black surfaces. The label stays neutral in the UI.
 */
const rosso: ThemePreset = {
  id: 'ferrari',
  label: 'Rosso',
  layout: 'grid',
  tokens: {
    light: {
      primary: '#D40000',
      onPrimary: '#FFFFFF',
      accent: '#FFF200',
      onAccent: '#121212',
      surface: '#FFFFFF',
      surfaceMuted: '#F5F2EE',
      onSurface: '#121212',
      outline: '#D9D4CE',
      success: '#1B7F3B',
      warning: '#B26A00',
      danger: '#B00020',
      radius: 'md',
      font: 'sans',
    },
    dark: {
      primary: '#E00000',
      onPrimary: '#FFFFFF',
      accent: '#FFE600',
      onAccent: '#121212',
      surface: '#0E0E0E',
      surfaceMuted: '#1A1A1A',
      onSurface: '#F5F5F5',
      outline: '#3A3A3A',
      success: '#3DDC84',
      warning: '#FFB020',
      danger: '#FF6B6B',
      radius: 'md',
      font: 'sans',
    },
  },
}

/**
 * Ember — brand orange #FF6A00 with near-black text: white on #FF6A00 is only
 * 2.9:1, so filled controls use `onPrimary` for AA.
 */
const ember: ThemePreset = {
  id: 'alibaba',
  label: 'Ember',
  layout: 'grid',
  tokens: {
    light: {
      primary: '#FF6A00',
      onPrimary: '#1A1A1A',
      accent: '#FFB300',
      onAccent: '#1A1A1A',
      surface: '#FFFDF9',
      surfaceMuted: '#FFF4EA',
      onSurface: '#1A1A1A',
      outline: '#E8DED4',
      success: '#1B7F3B',
      warning: '#8A5A00',
      danger: '#B00020',
      radius: 'md',
      font: 'sans',
    },
    dark: {
      primary: '#FF8A3D',
      onPrimary: '#1A1A1A',
      accent: '#FFC94D',
      onAccent: '#1A1A1A',
      surface: '#12100E',
      surfaceMuted: '#1F1813',
      onSurface: '#F5EFE9',
      outline: '#3A3129',
      success: '#3DDC84',
      warning: '#FFB020',
      danger: '#FF6B6B',
      radius: 'md',
      font: 'sans',
    },
  },
}

const ocean: ThemePreset = {
  id: 'ocean',
  label: 'Ocean',
  layout: 'grid',
  tokens: {
    light: {
      primary: '#0B6E99',
      onPrimary: '#FFFFFF',
      accent: '#F2A900',
      onAccent: '#1A1A1A',
      surface: '#F7FBFD',
      surfaceMuted: '#EAF3F8',
      onSurface: '#0B1B24',
      outline: '#C9DDE7',
      success: '#1B7F3B',
      warning: '#8A5A00',
      danger: '#B00020',
      radius: 'md',
      font: 'sans',
    },
    dark: {
      primary: '#4FB3D9',
      onPrimary: '#06212E',
      accent: '#FFC24D',
      onAccent: '#1A1A1A',
      surface: '#0A1418',
      surfaceMuted: '#122229',
      onSurface: '#E8F3F7',
      outline: '#2A3F49',
      success: '#3DDC84',
      warning: '#FFB020',
      danger: '#FF6B6B',
      radius: 'md',
      font: 'sans',
    },
  },
}

const forest: ThemePreset = {
  id: 'forest',
  label: 'Forest',
  layout: 'list',
  tokens: {
    light: {
      primary: '#1F6B45',
      onPrimary: '#FFFFFF',
      accent: '#C9A227',
      onAccent: '#1A1A1A',
      surface: '#FAFCF9',
      surfaceMuted: '#EDF4EE',
      onSurface: '#14241B',
      outline: '#CBDCCF',
      success: '#1B7F3B',
      warning: '#8A5A00',
      danger: '#B00020',
      radius: 'md',
      font: 'serif',
    },
    dark: {
      primary: '#6FCF97',
      onPrimary: '#0B1F13',
      accent: '#E8C547',
      onAccent: '#1A1A1A',
      surface: '#0D1711',
      surfaceMuted: '#16261C',
      onSurface: '#E9F4EC',
      outline: '#2E4234',
      success: '#3DDC84',
      warning: '#FFB020',
      danger: '#FF6B6B',
      radius: 'md',
      font: 'serif',
    },
  },
}

const mono: ThemePreset = {
  id: 'mono',
  label: 'Mono',
  layout: 'compact',
  tokens: {
    light: {
      primary: '#1F1F1F',
      onPrimary: '#FFFFFF',
      accent: '#D4D4D4',
      onAccent: '#1A1A1A',
      surface: '#FFFFFF',
      surfaceMuted: '#F2F2F2',
      onSurface: '#111111',
      outline: '#DCDCDC',
      success: '#1B7F3B',
      warning: '#8A5A00',
      danger: '#B00020',
      radius: 'sm',
      font: 'sans',
    },
    dark: {
      primary: '#EDEDED',
      onPrimary: '#111111',
      accent: '#8A8A8A',
      onAccent: '#111111',
      surface: '#0F0F0F',
      surfaceMuted: '#1B1B1B',
      onSurface: '#F5F5F5',
      outline: '#333333',
      success: '#3DDC84',
      warning: '#FFB020',
      danger: '#FF6B6B',
      radius: 'sm',
      font: 'sans',
    },
  },
}

export const THEME_PRESETS: readonly ThemePreset[] = [rosso, ember, ocean, forest, mono]

export const DEFAULT_PRESET_ID = 'ferrari'

export function listPresets(): readonly ThemePreset[] {
  return THEME_PRESETS
}

export function getPreset(id: string): ThemePreset {
  const preset = THEME_PRESETS.find((candidate) => candidate.id === id)
  if (!preset) {
    throw new Error(`Unknown theme preset: ${id}`)
  }
  return preset
}

export function defaultPreset(): ThemePreset {
  return getPreset(DEFAULT_PRESET_ID)
}
