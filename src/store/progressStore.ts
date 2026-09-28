import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { Module } from '../content/loader'
import type { Grade } from 'ts-fsrs'
import {
  dayKey,
  initialProgress,
  markLessonRead,
  migrateProgress,
  recordAttempt,
  recordExam,
  recordHint,
  recordReview,
  type ProgressState,
} from '../engine/progress'
import { reviewCard } from '../engine/srs'

// IndexedDB vía idb-keyval. Si no está disponible (modo privado, tests en
// jsdom), la app sigue funcionando en memoria en lugar de romperse.
const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await get<string>(name)) ?? null
    } catch {
      return null
    }
  },
  setItem: async (name, value) => {
    try {
      await set(name, value)
    } catch {
      /* sin persistencia disponible */
    }
  },
  removeItem: async (name) => {
    try {
      await del(name)
    } catch {
      /* sin persistencia disponible */
    }
  },
}

interface ProgressActions {
  lessonRead: (moduleRef: string, lessonId: string) => void
  hintUsed: (key: string) => void
  attempt: (key: string, correct: boolean) => void
  exam: (mod: Module, score: number) => void
  review: (cardKey: string, grade: Grade) => void
  /** Sustituye todo el progreso (importar copia). */
  replace: (progress: ProgressState) => void
  reset: () => void
}

export type ProgressStore = ProgressState & ProgressActions

const today = () => dayKey(new Date())

// Durante un cambio masivo (importar, borrar) no se anuncian insignias "nuevas".
let bulk = false
export const isBulkChange = () => bulk
function bulkChange(fn: () => void) {
  bulk = true
  try {
    fn()
  } finally {
    bulk = false
  }
}

export const useProgress = create<ProgressStore>()(
  persist(
    (setState) => ({
      ...initialProgress(),
      lessonRead: (ref, lessonId) => setState((s) => markLessonRead(s, ref, lessonId, today())),
      hintUsed: (key) => setState((s) => recordHint(s, key)),
      attempt: (key, correct) => setState((s) => recordAttempt(s, key, correct, today())),
      exam: (mod, score) => setState((s) => recordExam(s, mod, score, today())),
      review: (key, grade) =>
        setState((s) => {
          const now = new Date()
          return recordReview(s, key, reviewCard(s.cards[key], grade, now), dayKey(now))
        }),
      replace: (progress) => bulkChange(() => setState(progress)),
      reset: () => bulkChange(() => setState(initialProgress())),
    }),
    {
      name: 'kubernetete-progress',
      version: 2,
      migrate: (saved, fromVersion) => migrateProgress(saved, fromVersion),
      storage: createJSONStorage(() => idbStorage),
      // Solo se guardan datos, no las funciones.
      partialize: ({ version, xp, lessonsRead, exercises, exams, streak, cards }) => ({
        version,
        xp,
        lessonsRead,
        exercises,
        exams,
        streak,
        cards,
      }),
    },
  ),
)
