import { load } from 'js-yaml'
import { LessonFrontmatterSchema, type LessonFrontmatter } from './schema'

// Secciones obligatorias de toda lección, en este orden (guía de estilo).
export const REQUIRED_SECTIONS = [
  'Qué problema resuelve',
  'Analogía',
  'Concepto',
  'Ejemplo',
  'Errores comunes',
  'En la entrevista',
  'Resumen',
] as const

export interface ParsedLesson {
  frontmatter: LessonFrontmatter
  body: string
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseLesson(source: string): ParsedLesson {
  const match = FRONTMATTER.exec(source)
  if (!match) throw new Error('falta el bloque de frontmatter (--- ... ---) al inicio')
  const frontmatter = LessonFrontmatterSchema.parse(load(match[1]))
  return { frontmatter, body: source.slice(match[0].length).trim() }
}

/** Devuelve los problemas de estructura; lista vacía si la lección es válida. */
export function checkSections(body: string): string[] {
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  const problems: string[] = []
  let cursor = 0
  for (const section of REQUIRED_SECTIONS) {
    const idx = headings.indexOf(section, cursor)
    if (idx === -1) {
      problems.push(headings.includes(section) ? `sección "${section}" fuera de orden` : `falta la sección "${section}"`)
    } else {
      cursor = idx + 1
    }
  }
  return problems
}
