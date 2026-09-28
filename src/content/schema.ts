import { z } from 'zod'

// Esquemas de todo el contenido de /content. Se usan en el loader (runtime)
// y en content.test.ts, así que un JSON mal escrito rompe tests y build.

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'solo minúsculas, números y guiones')

export const LEVELS = [0, 1, 2, 3, 4, 5] as const
export const LEVEL_NAMES: Record<number, string> = {
  0: 'Fundamentos',
  1: 'Principiante',
  2: 'Junior',
  3: 'Intermedio',
  4: 'Avanzado',
  5: 'Entrevista',
}

export const TrackSchema = z.strictObject({
  id,
  title: z.string().min(1),
  description: z.string().min(1),
  optional: z.boolean().default(false),
})

export const TracksFileSchema = z.strictObject({
  tracks: z.array(TrackSchema).min(1),
})

// Referencia a un módulo: "<itinerario>/<módulo>", p. ej. "kubernetes/l1-pods".
export const ModuleRef = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'formato <itinerario>/<módulo>')

export const ModuleSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  level: z.union(LEVELS.map((l) => z.literal(l))),
  order: z.number().int().nonnegative(),
  xp: z.number().int().positive(),
  prereqs: z.array(ModuleRef).default([]),
})

export const LessonFrontmatterSchema = z.strictObject({
  title: z.string().min(1),
  minutes: z.number().int().positive(),
})

// --- Ejercicios -----------------------------------------------------------

const hints = z.array(z.string().min(1)).min(1).max(3)
const solution = z.strictObject({
  answer: z.string().optional(),
  explanation: z.string().min(1),
})
const exerciseBase = {
  id,
  prompt: z.string().min(1),
  hints,
  solution,
}

const QuizOptionSchema = z.strictObject({
  id,
  text: z.string().min(1),
  correct: z.boolean(),
  explanation: z.string().min(1),
})

export const QuizExerciseSchema = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('quiz'),
    mode: z.enum(['single', 'multi', 'truefalse']),
    options: z.array(QuizOptionSchema).min(2),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.correct).length
    if (correct === 0) ctx.addIssue({ code: 'custom', message: 'el quiz no tiene ninguna opción correcta' })
    if (q.mode !== 'multi' && correct !== 1)
      ctx.addIssue({ code: 'custom', message: `modo ${q.mode} exige exactamente 1 opción correcta` })
    if (q.mode === 'truefalse' && q.options.length !== 2)
      ctx.addIssue({ code: 'custom', message: 'truefalse exige exactamente 2 opciones' })
  })

export const CLIS = ['kubectl', 'helm', 'docker', 'terraform', 'ansible', 'ansible-playbook', 'ansible-galaxy', 'ansible-vault', 'gcloud', 'aws', 'az'] as const

export const CommandExerciseSchema = z.strictObject({
  ...exerciseBase,
  type: z.literal('command'),
  cli: z.enum(CLIS),
  accepted: z.array(z.string().min(1)).min(1),
  patterns: z.array(z.string()).default([]),
  output: z.string().optional(),
})

export const FillExerciseSchema = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('fill'),
    language: z.enum(['shell', 'yaml', 'hcl']),
    // Los huecos se marcan como {{id}} dentro de la plantilla.
    template: z.string().min(1),
    blanks: z.array(z.strictObject({ id, accepted: z.array(z.string().min(1)).min(1) })).min(1),
  })
  .superRefine((f, ctx) => {
    const inTemplate = [...f.template.matchAll(/\{\{([a-z0-9-]+)\}\}/g)].map((m) => m[1])
    const declared = f.blanks.map((b) => b.id)
    for (const b of declared)
      if (!inTemplate.includes(b)) ctx.addIssue({ code: 'custom', message: `hueco "${b}" no aparece en la plantilla` })
    for (const t of inTemplate)
      if (!declared.includes(t)) ctx.addIssue({ code: 'custom', message: `la plantilla usa {{${t}}} sin declararlo en blanks` })
  })

export const AssertionSchema = z
  .strictObject({
    path: z.string().min(1),
    op: z.enum(['exists', 'absent', 'equals', 'matches', 'oneOf', 'count', 'hasKeys']),
    value: z.unknown().optional(),
    // Se muestra al corregir: debe explicar QUÉ se comprueba, en lenguaje claro.
    message: z.string().min(1),
  })
  .superRefine((a, ctx) => {
    const needsValue = ['equals', 'matches', 'oneOf', 'count', 'hasKeys'].includes(a.op)
    if (needsValue && a.value === undefined) ctx.addIssue({ code: 'custom', message: `el operador ${a.op} necesita "value"` })
    if (!needsValue && a.value !== undefined) ctx.addIssue({ code: 'custom', message: `el operador ${a.op} no usa "value"` })
    if (a.op === 'oneOf' && !Array.isArray(a.value)) ctx.addIssue({ code: 'custom', message: 'oneOf necesita una lista en "value"' })
    if (a.op === 'hasKeys' && !(Array.isArray(a.value) && a.value.every((k) => typeof k === 'string')))
      ctx.addIssue({ code: 'custom', message: 'hasKeys necesita una lista de claves en "value"' })
    if (a.op === 'count' && !Number.isInteger(a.value)) ctx.addIssue({ code: 'custom', message: 'count necesita un entero en "value"' })
    if (a.op === 'matches') {
      try {
        new RegExp(String(a.value))
      } catch {
        ctx.addIssue({ code: 'custom', message: `regex inválida: ${String(a.value)}` })
      }
    }
  })

export const EditorExerciseSchema = z.strictObject({
  ...exerciseBase,
  type: z.literal('editor'),
  language: z.enum(['yaml', 'hcl']),
  starter: z.string(),
  assertions: z.array(AssertionSchema).min(1),
})

export const ExerciseSchema = z.discriminatedUnion('type', [
  QuizExerciseSchema,
  CommandExerciseSchema,
  FillExerciseSchema,
  EditorExerciseSchema,
])

export const ExercisesFileSchema = z.strictObject({
  exercises: z.array(ExerciseSchema).min(1),
})

// --- Flashcards y glosario ------------------------------------------------

export const FlashcardSchema = z.strictObject({
  id,
  front: z.string().min(1),
  back: z.string().min(1),
})

export const FlashcardsFileSchema = z.strictObject({
  cards: z.array(FlashcardSchema).min(1),
})

export const GlossaryEntrySchema = z.strictObject({
  term: z.string().min(1),
  definition: z.string().min(1),
  // Primer módulo de su itinerario que usa el término (lo comprueba content.test.ts).
  introducedIn: ModuleRef,
  // true: el tooltip solo sale en las lecciones de su itinerario. Para términos
  // genéricos o ambiguos fuera de él ("Service" en "Private Service Connect",
  // "Node" en "Node.js", "plan" como palabra española...).
  trackOnly: z.boolean().optional(),
})

export const GlossaryFileSchema = z.strictObject({
  entries: z.array(GlossaryEntrySchema),
})

export type Track = z.infer<typeof TrackSchema>
export type ModuleMeta = z.infer<typeof ModuleSchema>
export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>
export type Exercise = z.infer<typeof ExerciseSchema>
export type QuizExercise = z.infer<typeof QuizExerciseSchema>
export type CommandExercise = z.infer<typeof CommandExerciseSchema>
export type FillExercise = z.infer<typeof FillExerciseSchema>
export type EditorExercise = z.infer<typeof EditorExerciseSchema>
export type Flashcard = z.infer<typeof FlashcardSchema>
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>

// --- Especificaciones de CLI (autocompletado y corrección de comandos) ------

export const CliFlagSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  short: z.string().regex(/^[a-zA-Z0-9]$/).optional(),
  takesValue: z.boolean(),
  /** Sugerencias de autocompletado; con strict, además, los únicos valores válidos. */
  values: z.array(z.string()).optional(),
  strict: z.boolean().optional(),
  description: z.string().min(1),
})

export const CliArgSchema = z.strictObject({
  name: z.string().min(1),
  valueSet: z.string().optional(),
})

export interface CliCommand {
  name: string
  aliases?: string[]
  description: string
  source?: string
  args?: z.infer<typeof CliArgSchema>[]
  flags?: z.infer<typeof CliFlagSchema>[]
  subcommands?: CliCommand[]
}

export const CliCommandSchema: z.ZodType<CliCommand> = z.lazy(() =>
  z.strictObject({
    name: z.string().min(1),
    aliases: z.array(z.string()).optional(),
    description: z.string().min(1),
    source: z.url().optional(),
    args: z.array(CliArgSchema).optional(),
    flags: z.array(CliFlagSchema).optional(),
    subcommands: z.array(CliCommandSchema).optional(),
  }),
)

export const CliSpecSchema = z
  .strictObject({
    cli: z.enum(CLIS),
    description: z.string().min(1),
    source: z.url(),
    /** gnu: --largo y -c corto (kubectl, gcloud...). single-dash: -largo y -largo=valor (terraform, estilo Go). */
    flagStyle: z.enum(['gnu', 'single-dash']).default('gnu'),
    valueSets: z
      .record(z.string(), z.array(z.strictObject({ value: z.string(), aliases: z.array(z.string()).optional(), description: z.string() })))
      .default({}),
    globalFlags: z.array(CliFlagSchema).default([]),
    /** Posicionales de la propia CLI, para las que no tienen subcomandos (p. ej. `ansible <patrón>`). */
    args: z.array(CliArgSchema).optional(),
    commands: z.array(CliCommandSchema).default([]),
  })
  .superRefine((spec, ctx) => {
    if (spec.commands.length === 0 && !spec.args?.length)
      ctx.addIssue({ code: 'custom', message: 'la CLI necesita "commands" o "args"' })
    const walk = (cmds: CliCommand[], path: string) => {
      for (const c of cmds) {
        for (const a of c.args ?? [])
          if (a.valueSet && !spec.valueSets[a.valueSet])
            ctx.addIssue({ code: 'custom', message: `${path} ${c.name}: valueSet "${a.valueSet}" no existe` })
        if (!c.source && path === spec.cli)
          ctx.addIssue({ code: 'custom', message: `${c.name}: falta la URL "source" de la documentación oficial` })
        walk(c.subcommands ?? [], `${path} ${c.name}`)
      }
    }
    walk(spec.commands, spec.cli)
  })

export type CliFlag = z.infer<typeof CliFlagSchema>
export type CliSpec = z.infer<typeof CliSpecSchema>
