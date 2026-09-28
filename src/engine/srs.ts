import { createEmptyCard, fsrs, Rating, type Card, type CardInput, type Grade } from 'ts-fsrs'
import type { Catalog, Module } from '../content/loader'
import type { Flashcard } from '../content/schema'
import { isUnlocked, type ProgressState } from './progress'

// Repaso espaciado con FSRS (ts-fsrs). Las tarjetas se guardan serializadas
// (fechas como texto ISO) dentro del progreso.

export type StoredCard = Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string }

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const satisfies readonly Grade[]
export const GRADE_LABEL: Record<Grade, string> = {
  [Rating.Again]: 'Otra vez',
  [Rating.Hard]: 'Difícil',
  [Rating.Good]: 'Bien',
  [Rating.Easy]: 'Fácil',
}

// Parámetros por defecto de ts-fsrs (retención objetivo 90 %), sin "fuzz"
// para que los intervalos sean predecibles.
const scheduler = fsrs()

export const cardKey = (moduleRef: string, cardId: string) => `${moduleRef}#${cardId}`

function toStored(card: Card): StoredCard {
  const { due, last_review, ...rest } = card
  return { ...rest, due: due.toISOString(), ...(last_review ? { last_review: last_review.toISOString() } : {}) }
}

const toInput = (s: StoredCard | undefined, now: Date): CardInput | Card => s ?? createEmptyCard(now)

/** Aplica una valoración y devuelve el nuevo estado de la tarjeta. */
export function reviewCard(stored: StoredCard | undefined, grade: Grade, now: Date): StoredCard {
  return toStored(scheduler.next(toInput(stored, now), now, grade).card)
}

/** Fecha de la próxima revisión para cada posible valoración (para mostrar en los botones). */
export function previewDue(stored: StoredCard | undefined, now: Date): Record<Grade, Date> {
  const preview = scheduler.repeat(toInput(stored, now), now)
  return Object.fromEntries(GRADES.map((g) => [g, preview[g].card.due])) as Record<Grade, Date>
}

export const isDue = (stored: StoredCard | undefined, now: Date) => !stored || new Date(stored.due) <= now

/** "1 min", "10 min", "5 h", "3 d", "2 meses", "1 año". */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.round(days / 365)
  return `${years} ${years === 1 ? 'año' : 'años'}`
}

export interface QueueItem {
  key: string
  mod: Module
  card: Flashcard
  stored?: StoredCard
}

/**
 * Tarjetas disponibles: las de módulos desbloqueados cuyas lecciones se han
 * leído todas (primero hay que aprender, luego repasar).
 */
export function availableCards(catalog: Catalog, progress: ProgressState): QueueItem[] {
  return catalog.modules
    .filter((m) => {
      const read = progress.lessonsRead[m.ref] ?? []
      return m.lessons.length > 0 && m.lessons.every((l) => read.includes(l.id)) && isUnlocked(catalog, progress, m)
    })
    .flatMap((mod) =>
      mod.flashcards.map((card) => {
        const key = cardKey(mod.ref, card.id)
        return { key, mod, card, stored: progress.cards[key] }
      }),
    )
}

/** Cola de hoy: primero las vencidas (la más atrasada antes) y luego las nuevas. */
export function dueQueue(catalog: Catalog, progress: ProgressState, now: Date): QueueItem[] {
  const due = availableCards(catalog, progress).filter((i) => isDue(i.stored, now))
  const reviews = due.filter((i) => i.stored).sort((a, b) => a.stored!.due.localeCompare(b.stored!.due))
  const fresh = due.filter((i) => !i.stored)
  return [...reviews, ...fresh]
}

/** Próxima fecha en la que habrá alguna tarjeta pendiente (para "vuelve el ..."). */
export function nextDue(catalog: Catalog, progress: ProgressState): Date | null {
  const dates = availableCards(catalog, progress)
    .filter((i) => i.stored)
    .map((i) => new Date(i.stored!.due).getTime())
  return dates.length ? new Date(Math.min(...dates)) : null
}
