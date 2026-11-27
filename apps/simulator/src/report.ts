import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ScenarioResult } from './scenarios'

export interface Journal {
  version: 1
  scenario: string
  options: Record<string, number>
  startedAt: string
  ok: boolean
  steps: ScenarioResult['steps']
  metrics?: Record<string, number>
  error?: string
}

export function printResult(result: ScenarioResult, verbose = false): void {
  const status = result.ok ? 'PASS' : 'FAIL'
  console.log(`\n${status}  ${result.scenario}`)
  for (const step of result.steps) {
    if (!verbose && step.ok) continue
    const mark = step.ok ? 'ok' : 'FAIL'
    console.log(
      `  ${mark.padEnd(4)} ${step.name.padEnd(38)} ${String(step.ms).padStart(5)}ms${
        step.detail ? `  ${step.detail}` : ''
      }`,
    )
  }
  if (result.metrics) {
    console.log('  metrics:', JSON.stringify(result.metrics))
  }
  if (result.error) console.log(`  error: ${result.error}`)
}

export async function writeJournal(
  result: ScenarioResult,
  options: Record<string, number> = {},
): Promise<string> {
  const dir = resolve(process.cwd(), 'sim-reports')
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = resolve(dir, `${result.scenario}-${stamp}.json`)
  const journal: Journal = {
    version: 1,
    scenario: result.scenario,
    options,
    startedAt: new Date().toISOString(),
    ok: result.ok,
    steps: result.steps,
    metrics: result.metrics,
    error: result.error,
  }
  await writeFile(file, `${JSON.stringify(journal, null, 2)}\n`, 'utf8')
  return file
}

export async function readJournal(file: string): Promise<Journal> {
  const parsed = JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8')) as Journal
  if (parsed.version !== 1 || !parsed.scenario) {
    throw new Error('Not a simulator journal (v1)')
  }
  return parsed
}
