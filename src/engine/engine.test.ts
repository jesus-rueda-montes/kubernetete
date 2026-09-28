import { describe, expect, test } from 'vitest'
import type { Catalog, Module } from '../content/loader'
import type { FillExercise, QuizExercise } from '../content/schema'
import { buildExam, examScore, shuffle } from './exam'
import { grade, gradeFill, gradeQuiz, splitTemplate } from './grade'
import {
  dayKey,
  exerciseKey,
  initialProgress,
  isUnlocked,
  lockReasons,
  markLessonRead,
  recordAttempt,
  recordExam,
  recordHint,
  touchStreak,
  XP,
} from './progress'

const base = { prompt: 'p', hints: ['h'], solution: { explanation: 'e' } }
const quiz = (mode: QuizExercise['mode'], correct: string[]): QuizExercise => ({
  ...base,
  id: 'q',
  type: 'quiz',
  mode,
  options: ['a', 'b', 'c'].map((id) => ({ id, text: id, correct: correct.includes(id), explanation: 'x' })),
})

describe('grade', () => {
  test('quiz single', () => {
    const q = quiz('single', ['b'])
    expect(gradeQuiz(q, ['b']).correct).toBe(true)
    expect(gradeQuiz(q, ['a']).correct).toBe(false)
    expect(gradeQuiz(q, []).correct).toBe(false)
  })

  test('quiz multi exige todas las correctas y ninguna incorrecta', () => {
    const q = quiz('multi', ['a', 'c'])
    expect(gradeQuiz(q, ['c', 'a']).correct).toBe(true)
    expect(gradeQuiz(q, ['a']).correct).toBe(false)
    const r = gradeQuiz(q, ['a', 'b', 'c'])
    expect(r.correct).toBe(false)
    expect(r.options).toEqual({ a: true, b: false, c: true })
  })

  const fill: FillExercise = {
    ...base,
    id: 'f',
    type: 'fill',
    language: 'shell',
    template: 'kubectl {{verbo}} web --{{flag}}=nginx',
    blanks: [
      { id: 'verbo', accepted: ['run'] },
      { id: 'flag', accepted: ['image'] },
    ],
  }

  test('fill corrige cada hueco y tolera espacios', () => {
    expect(gradeFill(fill, { verbo: ' run ', flag: 'image' }).correct).toBe(true)
    const r = gradeFill(fill, { verbo: 'run', flag: 'img' })
    expect(r).toEqual({ correct: false, blanks: { verbo: true, flag: false } })
    expect(gradeFill(fill, { verbo: 'RUN', flag: 'image' }).correct).toBe(false)
  })

  test('grade rechaza respuestas de otro tipo', () => {
    expect(() => grade(fill, { type: 'quiz', selected: [] })).toThrow()
  })

  test('splitTemplate', () => {
    expect(splitTemplate(fill.template)).toEqual([
      { text: 'kubectl ' },
      { blank: 'verbo' },
      { text: ' web --' },
      { blank: 'flag' },
      { text: '=nginx' },
    ])
  })
})

describe('racha', () => {
  test('dayKey usa la fecha local', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  test('días seguidos suman, saltarse un día reinicia', () => {
    let s = initialProgress()
    s = touchStreak(s, '2026-02-28')
    s = touchStreak(s, '2026-02-28')
    s = touchStreak(s, '2026-03-01')
    expect(s.streak).toEqual({ current: 2, best: 2, lastDay: '2026-03-01' })
    s = touchStreak(s, '2026-03-03')
    expect(s.streak).toEqual({ current: 1, best: 2, lastDay: '2026-03-03' })
  })
})

const mod = (trackId: string, slug: string, level: number, order: number, prereqs: string[] = []): Module =>
  ({
    title: slug, summary: 's', level, order, xp: 100, prereqs,
    ref: `${trackId}/${slug}`, trackId, slug, lessons: [], exercises: [], flashcards: [],
  }) as Module

describe('progreso', () => {
  const today = '2026-09-27'

  test('leer una lección da XP una sola vez', () => {
    let s = markLessonRead(initialProgress(), 'k/m', 'l1', today)
    s = markLessonRead(s, 'k/m', 'l1', today)
    expect(s.xp).toBe(XP.lesson)
    expect(s.lessonsRead['k/m']).toEqual(['l1'])
  })

  test('las pistas NO afectan a XP ni a la corrección', () => {
    const key = exerciseKey('k/m', 'e1')
    const withHints = recordAttempt(recordHint(recordHint(initialProgress(), key), key), key, true, today)
    const withoutHints = recordAttempt(initialProgress(), key, true, today)
    expect(withHints.xp).toBe(withoutHints.xp)
    expect(withHints.exercises[key]).toEqual({ solved: true, attempts: 1, hintsUsed: 2 })
    expect(withHints.streak).toEqual(withoutHints.streak)
  })

  test('resolver un ejercicio da XP solo la primera vez', () => {
    const key = exerciseKey('k/m', 'e1')
    let s = recordAttempt(initialProgress(), key, false, today)
    expect(s.xp).toBe(0)
    s = recordAttempt(s, key, true, today)
    s = recordAttempt(s, key, true, today)
    expect(s.xp).toBe(XP.exercise)
    expect(s.exercises[key]).toMatchObject({ solved: true, attempts: 3 })
  })

  test('examen: aprobar con >= 80% da el XP del módulo una vez y guarda la mejor nota', () => {
    const m = mod('k', 'm', 1, 1)
    let s = recordExam(initialProgress(), m, 0.5, today)
    expect(s.exams[m.ref]).toEqual({ best: 0.5, passed: false, attempts: 1 })
    s = recordExam(s, m, 0.8, today)
    s = recordExam(s, m, 1, today)
    s = recordExam(s, m, 0.2, today)
    expect(s.exams[m.ref]).toEqual({ best: 1, passed: true, attempts: 4 })
    expect(s.xp).toBe(100)
  })

  test('desbloqueo secuencial dentro del itinerario y por prerequisitos', () => {
    const k1 = mod('k', 'a', 1, 1)
    const k2 = mod('k', 'b', 1, 2)
    const c1 = mod('c', 'x', 1, 1)
    const k3 = mod('k', 'c', 2, 1, ['c/x'])
    const catalog: Catalog = { tracks: [], glossary: [], modules: [k1, k2, c1, k3] }
    let s = initialProgress()
    expect(isUnlocked(catalog, s, k1)).toBe(true)
    expect(isUnlocked(catalog, s, c1)).toBe(true)
    expect(lockReasons(catalog, s, k2)).toEqual([{ kind: 'previous', module: k1 }])
    s = recordExam(s, k1, 1, today)
    expect(isUnlocked(catalog, s, k2)).toBe(true)
    s = recordExam(s, k2, 1, today)
    expect(lockReasons(catalog, s, k3)).toEqual([{ kind: 'prereq', module: c1 }])
    s = recordExam(s, c1, 0.9, today)
    expect(isUnlocked(catalog, s, k3)).toBe(true)
  })
})

describe('examen', () => {
  test('shuffle determinista con rng inyectado y sin perder elementos', () => {
    const out = shuffle([1, 2, 3, 4], () => 0)
    expect(out).toEqual([2, 3, 4, 1])
    expect([...out].sort()).toEqual([1, 2, 3, 4])
  })

  test('buildExam incluye todos los tipos y como máximo 10 preguntas', () => {
    const editor = { ...base, id: 'e', type: 'editor' as const, language: 'hcl' as const, starter: '', assertions: [{ path: 'kind', op: 'exists' as const, message: 'm' }] }
    expect(buildExam([quiz('single', ['a']), editor]).map((e) => e.type).sort()).toEqual(['editor', 'quiz'])
    expect(buildExam(Array.from({ length: 14 }, (_, i) => ({ ...quiz('single', ['a']), id: `q${i}` })))).toHaveLength(10)
  })

  test('examScore', () => {
    expect(examScore([true, true, true, false])).toBe(0.75)
    expect(examScore([])).toBe(0)
  })
})
