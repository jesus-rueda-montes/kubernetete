import type { Catalog } from '../content/loader'
import type { Exercise } from '../content/schema'
import type { ProgressState } from './progress'

// Insignias: se calculan a partir del progreso (no se guardan), así nunca se
// desincronizan. Regla: ninguna premia NO usar pistas, porque las pistas no
// deben tener coste de ningún tipo.

export interface Badge {
  id: string
  icon: string
  title: string
  description: string
  earned: boolean
  /** Progreso hacia la insignia, para mostrar "3/7". */
  current: number
  target: number
}

interface Def {
  id: string
  icon: string
  title: string
  description: string
  target: number
  value: (ctx: Ctx) => number
}

interface Ctx {
  catalog: Catalog
  p: ProgressState
  solvedTypes: Set<Exercise['type']>
  solvedCommands: number
}

const DEFS: Def[] = [
  { id: 'primera-leccion', icon: '📖', title: 'Primeros pasos', description: 'Termina tu primera lección.', target: 1, value: ({ p }) => Object.values(p.lessonsRead).flat().length },
  { id: 'primer-ejercicio', icon: '✅', title: 'Manos a la obra', description: 'Resuelve tu primer ejercicio.', target: 1, value: ({ p }) => Object.values(p.exercises).filter((e) => e.solved).length },
  { id: 'primer-examen', icon: '🎓', title: 'Aprobado', description: 'Aprueba el examen de un módulo.', target: 1, value: ({ p }) => Object.values(p.exams).filter((e) => e.passed).length },
  { id: 'nota-perfecta', icon: '💯', title: 'Matrícula', description: 'Saca un 100 % en un examen.', target: 1, value: ({ p }) => Object.values(p.exams).filter((e) => e.best === 1).length },
  { id: 'terminal', icon: '⌨️', title: 'Soltura en la terminal', description: 'Resuelve 5 ejercicios de comandos.', target: 5, value: ({ solvedCommands }) => solvedCommands },
  { id: 'todoterreno', icon: '🧰', title: 'Todoterreno', description: 'Resuelve al menos un ejercicio de cada tipo: test, comando, huecos y editor.', target: 4, value: ({ solvedTypes }) => solvedTypes.size },
  { id: 'racha-3', icon: '🔥', title: 'En racha', description: 'Estudia 3 días seguidos.', target: 3, value: ({ p }) => p.streak.best },
  { id: 'racha-7', icon: '🔥', title: 'Una semana', description: 'Estudia 7 días seguidos.', target: 7, value: ({ p }) => p.streak.best },
  { id: 'racha-30', icon: '🏔️', title: 'Constancia', description: 'Estudia 30 días seguidos.', target: 30, value: ({ p }) => p.streak.best },
  { id: 'repaso-25', icon: '🧠', title: 'Memoria a largo plazo', description: 'Haz 25 repasos de flashcards.', target: 25, value: ({ p }) => Object.values(p.cards).reduce((n, c) => n + c.reps, 0) },
  { id: 'xp-500', icon: '⭐', title: '500 XP', description: 'Consigue 500 puntos de experiencia.', target: 500, value: ({ p }) => p.xp },
  { id: 'xp-2000', icon: '🌟', title: '2000 XP', description: 'Consigue 2000 puntos de experiencia.', target: 2000, value: ({ p }) => p.xp },
]

function trackBadges(ctx: Ctx): Def[] {
  // Una por itinerario con contenido: aprobar todos sus módulos.
  return ctx.catalog.tracks.flatMap((t) => {
    const mods = ctx.catalog.modules.filter((m) => m.trackId === t.id)
    if (mods.length === 0) return []
    return [
      {
        id: `itinerario-${t.id}`,
        icon: '🏆',
        title: `${t.title} completado`,
        description: `Aprueba todos los módulos disponibles de ${t.title}.`,
        target: mods.length,
        value: ({ p }: Ctx) => mods.filter((m) => p.exams[m.ref]?.passed).length,
      },
    ]
  })
}

export function computeBadges(catalog: Catalog, p: ProgressState): Badge[] {
  const typeByKey = new Map<string, Exercise['type']>(
    catalog.modules.flatMap((m) => m.exercises.map((e) => [`${m.ref}#${e.id}`, e.type] as const)),
  )
  const solvedKeys = Object.entries(p.exercises).filter(([, e]) => e.solved).map(([k]) => k)
  const solvedTypes = new Set(solvedKeys.map((k) => typeByKey.get(k)).filter((t) => t !== undefined))
  const solvedCommands = solvedKeys.filter((k) => typeByKey.get(k) === 'command').length
  const ctx: Ctx = { catalog, p, solvedTypes, solvedCommands }

  return [...DEFS, ...trackBadges(ctx)].map((d) => {
    const current = Math.min(d.value(ctx), d.target)
    return { id: d.id, icon: d.icon, title: d.title, description: d.description, earned: current >= d.target, current, target: d.target }
  })
}

export const earnedIds = (badges: Badge[]) => new Set(badges.filter((b) => b.earned).map((b) => b.id))
