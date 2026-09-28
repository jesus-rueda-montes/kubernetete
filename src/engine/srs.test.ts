import { Rating } from 'ts-fsrs'
import { describe, expect, test } from 'vitest'
import type { Catalog, Module } from '../content/loader'
import { initialProgress, migrateProgress, recordExam, recordReview, XP } from './progress'
import { availableCards, cardKey, dueQueue, formatInterval, GRADES, isDue, nextDue, previewDue, reviewCard } from './srs'

const now = new Date('2026-09-27T10:00:00Z')
const minutes = (d: Date) => Math.round((d.getTime() - now.getTime()) / 60_000)

describe('FSRS', () => {
  test('una tarjeta nueva está pendiente; tras "Bien" se programa en el futuro', () => {
    expect(isDue(undefined, now)).toBe(true)
    const c = reviewCard(undefined, Rating.Good, now)
    expect(typeof c.due).toBe('string')
    expect(new Date(c.due) > now).toBe(true)
    expect(isDue(c, now)).toBe(false)
    expect(c.reps).toBe(1)
  })

  test('las valoraciones están ordenadas: Otra vez < Difícil < Bien < Fácil', () => {
    const p = previewDue(undefined, now)
    const m = GRADES.map((g) => minutes(p[g]))
    expect([...m].sort((a, b) => a - b)).toEqual(m)
    expect(m[0]).toBeLessThan(m[3])
  })

  test('al repasar bien varias veces el intervalo crece', () => {
    let c = reviewCard(undefined, Rating.Good, now)
    const intervals: number[] = []
    let t = now
    for (let i = 0; i < 4; i++) {
      t = new Date(c.due)
      const before = t
      c = reviewCard(c, Rating.Good, t)
      intervals.push(new Date(c.due).getTime() - before.getTime())
    }
    expect(intervals[3]).toBeGreaterThan(intervals[1])
  })

  test('formatInterval', () => {
    const at = (ms: number) => formatInterval(now, new Date(now.getTime() + ms))
    expect(at(10_000)).toBe('1 min')
    expect(at(10 * 60_000)).toBe('10 min')
    expect(at(5 * 3_600_000)).toBe('5 h')
    expect(at(3 * 86_400_000)).toBe('3 d')
    expect(at(62 * 86_400_000)).toBe('2 meses')
    expect(at(400 * 86_400_000)).toBe('1 año')
  })
})

const mod = (slug: string, order: number, lessons: string[], cards: string[]): Module =>
  ({
    title: slug, summary: 's', level: 1, order, xp: 100, prereqs: [],
    ref: `k/${slug}`, trackId: 'k', slug,
    lessons: lessons.map((id) => ({ id, path: `/content/k/${slug}/lessons/${id}.md`, frontmatter: { title: id, minutes: 1 } })),
    exercises: [],
    flashcards: cards.map((id) => ({ id, front: 'f', back: 'b' })),
  }) as Module

describe('cola de repaso', () => {
  const m1 = mod('a', 1, ['l1', 'l2'], ['c1', 'c2'])
  const m2 = mod('b', 2, ['l1'], ['c3'])
  const catalog: Catalog = { tracks: [], glossary: [], modules: [m1, m2] }

  test('las tarjetas se añaden al leer TODAS las lecciones de un módulo desbloqueado', () => {
    let s = initialProgress()
    expect(availableCards(catalog, s)).toEqual([])
    s = { ...s, lessonsRead: { 'k/a': ['l1'] } }
    expect(availableCards(catalog, s)).toEqual([])
    s = { ...s, lessonsRead: { 'k/a': ['l1', 'l2'], 'k/b': ['l1'] } }
    // k/b sigue bloqueado hasta aprobar el examen de k/a
    expect(availableCards(catalog, s).map((i) => i.key)).toEqual(['k/a#c1', 'k/a#c2'])
    s = recordExam(s, m1, 1, '2026-09-27')
    expect(availableCards(catalog, s).map((i) => i.key)).toEqual(['k/a#c1', 'k/a#c2', 'k/b#c3'])
  })

  test('primero las vencidas (más atrasada antes), luego las nuevas; las futuras no salen', () => {
    let s = { ...initialProgress(), lessonsRead: { 'k/a': ['l1', 'l2'] } }
    const old = reviewCard(undefined, Rating.Good, new Date('2026-09-01T00:00:00Z'))
    const future = reviewCard(undefined, Rating.Easy, now)
    s = { ...s, cards: { [cardKey('k/a', 'c2')]: old } }
    expect(dueQueue(catalog, s, now).map((i) => i.key)).toEqual(['k/a#c2', 'k/a#c1'])
    s = { ...s, cards: { ...s.cards, [cardKey('k/a', 'c1')]: future } }
    expect(dueQueue(catalog, s, now).map((i) => i.key)).toEqual(['k/a#c2'])
    expect(nextDue(catalog, s)?.toISOString()).toBe(old.due)
  })

  test('repasar suma racha y XP; migrar v1 añade las tarjetas vacías', () => {
    const s = recordReview(initialProgress(), 'k/a#c1', reviewCard(undefined, Rating.Good, now), '2026-09-27')
    expect(s.xp).toBe(XP.review)
    expect(s.streak.current).toBe(1)
    expect(Object.keys(s.cards)).toEqual(['k/a#c1'])
    const v1 = { version: 1, xp: 50, lessonsRead: {}, exercises: {}, exams: {}, streak: { current: 3, best: 3, lastDay: '2026-09-26' } }
    expect(migrateProgress(v1, 1)).toMatchObject({ version: 2, xp: 50, cards: {}, streak: { current: 3 } })
  })
})
