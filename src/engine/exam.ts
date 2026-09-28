import type { Module } from '../content/loader'
import type { Exercise } from '../content/schema'
import { isSupported } from './grade'

export const MAX_EXAM_QUESTIONS = 10

/** Fisher-Yates con un generador inyectable (para tests deterministas). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Preguntas del examen: ejercicios ya soportados, barajados, hasta MAX_EXAM_QUESTIONS. */
export function buildExam(exercises: readonly Exercise[], rng: () => number = Math.random): Exercise[] {
  return shuffle(exercises.filter(isSupported), rng).slice(0, MAX_EXAM_QUESTIONS)
}

/** Número de preguntas que tendrá el examen (sin descargar los ejercicios). */
export function examSize(mod: Module): number {
  return Math.min(mod.exercises.filter(isSupported).length, MAX_EXAM_QUESTIONS)
}

export function examScore(results: boolean[]): number {
  if (results.length === 0) return 0
  return results.filter(Boolean).length / results.length
}
