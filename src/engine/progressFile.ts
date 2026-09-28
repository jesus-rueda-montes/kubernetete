import { z } from 'zod'
import { migrateProgress, type ProgressState } from './progress'

// Exportar/importar el progreso como archivo JSON (copia de seguridad y para
// pasarlo a otro dispositivo). Al importar se valida y se migra de versión.

export const FILE_APP_ID = 'kubernetete'

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'fecha inválida')

const ProgressSchema = z.object({
  version: z.number().int().positive(),
  xp: z.number().nonnegative(),
  lessonsRead: z.record(z.string(), z.array(z.string())),
  exercises: z.record(z.string(), z.object({ solved: z.boolean(), attempts: z.number().int().nonnegative(), hintsUsed: z.number().int().nonnegative() })),
  exams: z.record(z.string(), z.object({ best: z.number().min(0).max(1), passed: z.boolean(), attempts: z.number().int().nonnegative() })),
  streak: z.object({ current: z.number().int().nonnegative(), best: z.number().int().nonnegative(), lastDay: z.string().nullable() }),
  // Estado FSRS: se valida lo imprescindible y se conserva el resto tal cual.
  cards: z.record(z.string(), z.looseObject({ due: isoDate, reps: z.number(), state: z.number() })).optional(),
})

const FileSchema = z.object({
  app: z.literal(FILE_APP_ID),
  exportedAt: isoDate,
  progress: ProgressSchema,
})

export function exportProgress(p: ProgressState, now: Date): string {
  const { version, xp, lessonsRead, exercises, exams, streak, cards } = p
  return JSON.stringify(
    { app: FILE_APP_ID, exportedAt: now.toISOString(), progress: { version, xp, lessonsRead, exercises, exams, streak, cards } },
    null,
    2,
  )
}

export type ImportResult = { ok: true; progress: ProgressState; exportedAt: Date } | { ok: false; error: string }

export function importProgress(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' }
  }
  if (typeof data !== 'object' || data === null || (data as { app?: unknown }).app !== FILE_APP_ID)
    return { ok: false, error: 'Este archivo no es una copia de progreso de Kubernetete.' }
  const res = FileSchema.safeParse(data)
  if (!res.success) {
    const issue = res.error.issues[0]
    return { ok: false, error: `El archivo está dañado o incompleto (${issue.path.join('.') || 'raíz'}: ${issue.message}).` }
  }
  const { progress, exportedAt } = res.data
  if (progress.version > 2) return { ok: false, error: 'La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.' }
  return { ok: true, progress: migrateProgress(progress, progress.version), exportedAt: new Date(exportedAt) }
}

export const exportFileName = (now: Date) => `kubernetete-progreso-${now.toISOString().slice(0, 10)}.json`
