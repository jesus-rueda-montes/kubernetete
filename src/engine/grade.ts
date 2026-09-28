import type { CliSpec, CommandExercise, Exercise, FillExercise, QuizExercise } from '../content/schema'
import { parseCommand, sameCommand } from './cli'
import { gradeHcl, type HclParser } from './hcl'
import { gradeYaml, type CheckResult } from './yamlAssert'

export type CliSpecLookup = Partial<Record<CliSpec['cli'], CliSpec>>

// Corrección de ejercicios: funciones puras, sin React.

export type Answer =
  | { type: 'quiz'; selected: string[] }
  | { type: 'fill'; values: Record<string, string> }
  | { type: 'command'; text: string }
  | { type: 'editor'; code: string }

export interface GradeResult {
  correct: boolean
  /** Para quiz: id de opción -> si el usuario acertó al marcarla o no marcarla. */
  options?: Record<string, boolean>
  /** Para fill: id de hueco -> acertado. */
  blanks?: Record<string, boolean>
  /** Para command/editor: explicación de por qué no es correcto. */
  feedback?: string
  /** Para editor: cada comprobación con su resultado. */
  checks?: CheckResult[]
}

/** Tipos que ya se pueden resolver. Crece según avanzan las fases. */
export const SUPPORTED_TYPES: ReadonlySet<Exercise['type']> = new Set(['quiz', 'fill', 'command', 'editor'])

export function isSupported(ex: Pick<Exercise, 'type'>): boolean {
  return SUPPORTED_TYPES.has(ex.type)
}

/** Lo que necesita la corrección además del ejercicio y la respuesta. */
export interface GradeContext {
  specs?: CliSpecLookup
  /** Obligatorio para ejercicios de editor HCL (se carga de forma asíncrona). */
  hcl?: HclParser
}

export const needsHcl = (ex: Exercise) => ex.type === 'editor' && ex.language === 'hcl'

export function gradeQuiz(ex: QuizExercise, selected: string[]): GradeResult {
  const chosen = new Set(selected)
  const options: Record<string, boolean> = {}
  for (const o of ex.options) options[o.id] = o.correct === chosen.has(o.id)
  return { correct: Object.values(options).every(Boolean), options }
}

// Espacios sobrantes fuera; mayúsculas sí importan (kubectl distingue).
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ')

export function gradeFill(ex: FillExercise, values: Record<string, string>): GradeResult {
  const blanks: Record<string, boolean> = {}
  for (const b of ex.blanks) {
    const v = normalize(values[b.id] ?? '')
    blanks[b.id] = b.accepted.some((a) => normalize(a) === v)
  }
  return { correct: Object.values(blanks).every(Boolean), blanks }
}

/**
 * Un comando es correcto si equivale a alguno de los aceptados: mismo
 * subcomando, posicionales (con alias normalizados) y flags, en cualquier
 * orden y en forma corta o larga. Como respaldo, se prueban los patrones regex.
 */
export function gradeCommand(ex: CommandExercise, text: string, spec: CliSpec | undefined): GradeResult {
  const clean = normalize(text)
  if (ex.patterns.some((p) => new RegExp(`^(?:${p})$`).test(clean))) return { correct: true }
  if (!spec) return { correct: ex.accepted.some((a) => normalize(a) === clean) }

  const parsed = parseCommand(spec, clean)
  if (!parsed.ok) return { correct: false, feedback: parsed.errors[0] }
  const ok = ex.accepted.some((a) => {
    const target = parseCommand(spec, a)
    return target.ok && sameCommand(parsed.command, target.command)
  })
  return ok
    ? { correct: true }
    : { correct: false, feedback: 'El comando es válido, pero no hace lo que pide el enunciado.' }
}

export function grade(ex: Exercise, answer: Answer, ctx: GradeContext = {}): GradeResult {
  const specs = ctx.specs ?? {}
  if (ex.type === 'quiz' && answer.type === 'quiz') return gradeQuiz(ex, answer.selected)
  if (ex.type === 'fill' && answer.type === 'fill') return gradeFill(ex, answer.values)
  if (ex.type === 'command' && answer.type === 'command') return gradeCommand(ex, answer.text, specs[ex.cli])
  if (ex.type === 'editor' && answer.type === 'editor') {
    if (ex.language === 'yaml') return gradeYaml(answer.code, ex.assertions)
    if (!ctx.hcl) throw new Error('falta el parser HCL en el contexto de corrección')
    return gradeHcl(ctx.hcl, answer.code, ex.assertions)
  }
  if (ex.type !== answer.type) throw new Error(`respuesta de tipo ${answer.type} para ejercicio ${ex.type}`)
  throw new Error(`corrección de "${ex.type}" aún no implementada`)
}

/** Parte la plantilla de un fill en texto literal y huecos, en orden. */
export function splitTemplate(template: string): ({ text: string } | { blank: string })[] {
  const parts: ({ text: string } | { blank: string })[] = []
  let last = 0
  for (const m of template.matchAll(/\{\{([a-z0-9-]+)\}\}/g)) {
    if (m.index > last) parts.push({ text: template.slice(last, m.index) })
    parts.push({ blank: m[1] })
    last = m.index + m[0].length
  }
  if (last < template.length) parts.push({ text: template.slice(last) })
  return parts
}

// Respuesta vacía para cada tipo de ejercicio.
export function emptyAnswer(ex: Exercise): Answer {
  switch (ex.type) {
    case 'quiz':
      return { type: 'quiz', selected: [] }
    case 'fill':
      return { type: 'fill', values: {} }
    case 'command':
      return { type: 'command', text: '' }
    case 'editor':
      return { type: 'editor', code: ex.starter }
  }
}

export function isAnswered(answer: Answer): boolean {
  switch (answer.type) {
    case 'quiz':
      return answer.selected.length > 0
    case 'fill':
      return Object.values(answer.values).some((v) => v.trim() !== '')
    case 'command':
      return answer.text.trim() !== ''
    case 'editor':
      return answer.code.trim() !== ''
  }
}
