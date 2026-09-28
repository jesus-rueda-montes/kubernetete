import type { Catalog, Module } from '../content/loader'
import type { StoredCard } from './srs'

// Estado de progreso y sus transiciones: funciones puras e inmutables.
// El store (Zustand) solo las envuelve y persiste el resultado.

export const PASS_SCORE = 0.8
export const XP = {
  lesson: 5,
  exercise: 10,
  review: 1,
} as const

export interface ExerciseProgress {
  solved: boolean
  attempts: number
  /** Solo estadística personal: NUNCA afecta a XP, nota, racha ni desbloqueo. */
  hintsUsed: number
}

export interface ExamProgress {
  best: number // 0..1
  passed: boolean
  attempts: number
}

export interface ProgressState {
  version: 2
  xp: number
  lessonsRead: Record<string, string[]> // ref módulo -> ids de lección
  exercises: Record<string, ExerciseProgress> // "<ref>#<id ejercicio>"
  exams: Record<string, ExamProgress> // ref módulo
  streak: { current: number; best: number; lastDay: string | null }
  cards: Record<string, StoredCard> // "<ref>#<id tarjeta>" -> estado FSRS
}

export const initialProgress = (): ProgressState => ({
  version: 2,
  xp: 0,
  lessonsRead: {},
  exercises: {},
  exams: {},
  streak: { current: 0, best: 0, lastDay: null },
  cards: {},
})

/** Actualiza datos guardados con versiones anteriores del formato. */
export function migrateProgress(saved: unknown, fromVersion: number): ProgressState {
  const s = { ...initialProgress(), ...(saved as Partial<ProgressState>) }
  if (fromVersion < 2) s.cards = {}
  return { ...s, version: 2 }
}

export const exerciseKey = (moduleRef: string, exerciseId: string) => `${moduleRef}#${exerciseId}`

// --- Fechas y racha ---------------------------------------------------------

/** Día local en formato YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1))
}

/** Cualquier actividad cuenta para la racha diaria. */
export function touchStreak(s: ProgressState, today: string): ProgressState {
  const { streak } = s
  if (streak.lastDay === today) return s
  const current = streak.lastDay === previousDay(today) ? streak.current + 1 : 1
  return { ...s, streak: { current, best: Math.max(streak.best, current), lastDay: today } }
}

// --- Eventos ----------------------------------------------------------------

export function markLessonRead(s: ProgressState, moduleRef: string, lessonId: string, today: string): ProgressState {
  const read = s.lessonsRead[moduleRef] ?? []
  const next = touchStreak(s, today)
  if (read.includes(lessonId)) return next
  return {
    ...next,
    xp: next.xp + XP.lesson,
    lessonsRead: { ...next.lessonsRead, [moduleRef]: [...read, lessonId] },
  }
}

export function recordHint(s: ProgressState, key: string): ProgressState {
  const prev = s.exercises[key] ?? { solved: false, attempts: 0, hintsUsed: 0 }
  return { ...s, exercises: { ...s.exercises, [key]: { ...prev, hintsUsed: prev.hintsUsed + 1 } } }
}

export function recordAttempt(s: ProgressState, key: string, correct: boolean, today: string): ProgressState {
  const prev = s.exercises[key] ?? { solved: false, attempts: 0, hintsUsed: 0 }
  const next = touchStreak(s, today)
  const firstSolve = correct && !prev.solved
  return {
    ...next,
    xp: next.xp + (firstSolve ? XP.exercise : 0),
    exercises: {
      ...next.exercises,
      [key]: { ...prev, attempts: prev.attempts + 1, solved: prev.solved || correct },
    },
  }
}

export function recordExam(s: ProgressState, mod: Module, score: number, today: string): ProgressState {
  const prev = s.exams[mod.ref] ?? { best: 0, passed: false, attempts: 0 }
  const passed = score >= PASS_SCORE
  const next = touchStreak(s, today)
  return {
    ...next,
    xp: next.xp + (passed && !prev.passed ? mod.xp : 0),
    exams: {
      ...next.exams,
      [mod.ref]: { best: Math.max(prev.best, score), passed: prev.passed || passed, attempts: prev.attempts + 1 },
    },
  }
}

/** Repasar una tarjeta cuenta para la racha y da un poco de XP. */
export function recordReview(s: ProgressState, key: string, card: StoredCard, today: string): ProgressState {
  const next = touchStreak(s, today)
  return { ...next, xp: next.xp + XP.review, cards: { ...next.cards, [key]: card } }
}

// --- Desbloqueo -------------------------------------------------------------

export type LockReason = { kind: 'previous'; module: Module } | { kind: 'prereq'; module: Module }

/**
 * Un módulo está desbloqueado si:
 * - el módulo anterior de su mismo itinerario (por nivel y orden) tiene el examen aprobado, y
 * - todos sus prerequisitos explícitos tienen el examen aprobado.
 * El primer módulo de cada itinerario está siempre abierto.
 */
export function lockReasons(catalog: Catalog, s: ProgressState, mod: Module): LockReason[] {
  const passed = (ref: string) => s.exams[ref]?.passed === true
  const reasons: LockReason[] = []
  const sameTrack = catalog.modules.filter((m) => m.trackId === mod.trackId) // ya vienen ordenados
  const idx = sameTrack.findIndex((m) => m.ref === mod.ref)
  const previous = idx > 0 ? sameTrack[idx - 1] : undefined
  if (previous && !passed(previous.ref)) reasons.push({ kind: 'previous', module: previous })
  for (const ref of mod.prereqs) {
    const pre = catalog.modules.find((m) => m.ref === ref)
    if (pre && !passed(ref) && pre !== previous) reasons.push({ kind: 'prereq', module: pre })
  }
  return reasons
}

export const isUnlocked = (catalog: Catalog, s: ProgressState, mod: Module) => lockReasons(catalog, s, mod).length === 0
