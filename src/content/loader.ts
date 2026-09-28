import { z } from 'zod'
import { parseCommand } from '../engine/cli'
import { gradeYaml, parsePath } from '../engine/yamlAssert'
import { checkSections, parseLesson, type ParsedLesson } from './lesson'
import {
  CliSpecSchema,
  ExercisesFileSchema,
  FlashcardsFileSchema,
  GlossaryFileSchema,
  ModuleSchema,
  TracksFileSchema,
  type CliSpec,
  type Exercise,
  type Flashcard,
  type GlossaryEntry,
  type ModuleMeta,
  type Track,
} from './schema'

// Carga /content y lo valida. Cualquier error se acumula en ContentError con la
// ruta del archivo culpable.
//
// En la app, el bundle inicial solo lleva el índice: frontmatter de las lecciones,
// id y tipo de cada ejercicio, flashcards y glosario. Los cuerpos de las lecciones,
// los ejercicios completos y las especificaciones de CLI se descargan al usarlos.
// Los tests construyen el catálogo completo (buildCatalog con full) y validan todo.

export interface Lesson {
  id: string // nombre de archivo sin extensión, p. ej. "01-que-es-un-pod"
  frontmatter: ParsedLesson['frontmatter']
  /** Ruta del archivo; con ella se carga el cuerpo bajo demanda (loadLessonBody). */
  path: string
  /** Solo presente si el catálogo se construyó con las lecciones completas (tests). */
  body?: string
}

export interface Module extends ModuleMeta {
  ref: string // "<itinerario>/<módulo>"
  trackId: string
  slug: string
  lessons: Lesson[]
  exercises: ExerciseSummary[]
  /** Ruta de exercises.json; con ella se cargan los ejercicios bajo demanda (loadExercises). */
  exercisesPath?: string
  /** Solo presente si el catálogo se construyó completo (tests). */
  fullExercises?: Exercise[]
  flashcards: Flashcard[]
}

/** Lo mínimo de un ejercicio para listarlo sin descargarlo. */
export type ExerciseSummary = Pick<Exercise, 'id' | 'type'>

export type CliSpecs = Partial<Record<CliSpec['cli'], CliSpec>>

export interface Catalog {
  tracks: Track[]
  modules: Module[]
  glossary: GlossaryEntry[]
}

const ExerciseIndexSchema = z.object({
  exercises: z.array(z.object({ id: z.string().min(1), type: z.enum(['quiz', 'fill', 'command', 'editor']) })).min(1),
})

export interface RawContent {
  tracks: unknown
  glossary: unknown
  modules: Record<string, unknown>
  lessons: Record<string, string>
  exercises: Record<string, unknown>
  flashcards: Record<string, unknown>
  cliSpecs: Record<string, unknown>
}

export class ContentError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`Contenido inválido:\n- ${problems.join('\n- ')}`)
    this.problems = problems
  }
}

const MODULE_PATH = /\/content\/([a-z0-9-]+)\/([a-z0-9-]+)\//
const LESSON_PATH = /\/lessons\/([a-z0-9-]+)\.md$/

function moduleRefOf(path: string): string | null {
  const m = MODULE_PATH.exec(path)
  return m ? `${m[1]}/${m[2]}` : null
}

function formatZod(path: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${path}${i.path.length ? ` [${i.path.join('.')}]` : ''}: ${i.message}`)
}

export interface BuildOptions {
  /**
   * true (tests): `raw` trae las lecciones completas, los ejercicios completos y
   * las especificaciones de CLI, y se valida todo.
   * false (app): solo el índice (frontmatter de las lecciones e id/tipo de los
   * ejercicios); el resto se carga bajo demanda.
   */
  full?: boolean
}

export function buildCatalog(raw: RawContent, { full = true }: BuildOptions = {}): Catalog {
  const problems: string[] = []

  const tracksRes = TracksFileSchema.safeParse(raw.tracks)
  if (!tracksRes.success) problems.push(...formatZod('content/tracks.json', tracksRes.error))
  const tracks = tracksRes.success ? tracksRes.data.tracks : []
  const trackIds = new Set(tracks.map((t) => t.id))

  const glossaryRes = GlossaryFileSchema.safeParse(raw.glossary)
  if (!glossaryRes.success) problems.push(...formatZod('content/glossary.json', glossaryRes.error))

  const cliSpecs: CliSpecs = {}
  for (const [path, data] of Object.entries(raw.cliSpecs)) {
    const res = CliSpecSchema.safeParse(data)
    if (!res.success) {
      problems.push(...formatZod(path, res.error))
      continue
    }
    const fileName = /\/([a-z-]+)\.json$/.exec(path)?.[1]
    if (fileName !== res.data.cli) problems.push(`${path}: el archivo debe llamarse ${res.data.cli}.json`)
    cliSpecs[res.data.cli] = res.data
  }

  const modules: Module[] = []
  for (const [path, data] of Object.entries(raw.modules)) {
    const ref = moduleRefOf(path)
    if (!ref) {
      problems.push(`${path}: ruta inesperada, debe ser content/<itinerario>/<módulo>/module.json`)
      continue
    }
    const [trackId, slug] = ref.split('/')
    if (!trackIds.has(trackId)) problems.push(`${path}: el itinerario "${trackId}" no existe en tracks.json`)
    const res = ModuleSchema.safeParse(data)
    if (!res.success) {
      problems.push(...formatZod(path, res.error))
      continue
    }
    modules.push({ ...res.data, ref, trackId, slug, lessons: [], exercises: [], flashcards: [] })
  }
  const byRef = new Map(modules.map((m) => [m.ref, m]))

  for (const [path, source] of Object.entries(raw.lessons)) {
    const mod = byRef.get(moduleRefOf(path) ?? '')
    const lessonId = LESSON_PATH.exec(path)?.[1]
    if (!mod || !lessonId) {
      problems.push(`${path}: lección fuera de un módulo válido`)
      continue
    }
    try {
      const parsed = parseLesson(source)
      if (full) {
        problems.push(...checkSections(parsed.body).map((p) => `${path}: ${p}`))
        mod.lessons.push({ id: lessonId, path, frontmatter: parsed.frontmatter, body: parsed.body })
      } else {
        mod.lessons.push({ id: lessonId, path, frontmatter: parsed.frontmatter })
      }
    } catch (e) {
      problems.push(...(e instanceof z.ZodError ? formatZod(path, e) : [`${path}: ${(e as Error).message}`]))
    }
  }

  for (const [path, data] of Object.entries(raw.exercises)) {
    const mod = byRef.get(moduleRefOf(path) ?? '')
    if (full) {
      const res = ExercisesFileSchema.safeParse(data)
      if (!res.success) problems.push(...formatZod(path, res.error))
      else if (mod) {
        mod.fullExercises = res.data.exercises
        mod.exercises = res.data.exercises.map(({ id, type }) => ({ id, type }))
      }
    } else {
      const res = ExerciseIndexSchema.safeParse(data)
      if (!res.success) problems.push(...formatZod(path, res.error))
      else if (mod) mod.exercises = res.data.exercises
    }
    if (mod) mod.exercisesPath = path
  }

  for (const [path, data] of Object.entries(raw.flashcards)) {
    const mod = byRef.get(moduleRefOf(path) ?? '')
    const res = FlashcardsFileSchema.safeParse(data)
    if (!res.success) problems.push(...formatZod(path, res.error))
    else if (mod) mod.flashcards = res.data.cards
  }

  for (const mod of modules) {
    mod.lessons.sort((a, b) => a.id.localeCompare(b.id))
    if (mod.lessons.length === 0) problems.push(`content/${mod.ref}: el módulo no tiene lecciones`)
    for (const p of mod.prereqs)
      if (!byRef.has(p)) problems.push(`content/${mod.ref}/module.json: prerequisito "${p}" no existe`)
    // Los comandos que un ejercicio da por buenos deben ser válidos según la
    // especificación de su CLI (transcrita de la documentación oficial).
    const where = `content/${mod.ref}/exercises.json`
    for (const ex of mod.fullExercises ?? []) {
      const commands: [string, string][] = []
      if (ex.type === 'command') {
        if (!cliSpecs[ex.cli]) problems.push(`${where} [${ex.id}]: no hay especificación para "${ex.cli}" en content/cli-specs/`)
        else for (const a of ex.accepted) commands.push([ex.cli, a])
      }
      const first = ex.solution.answer?.split(/\s+/)[0]
      if (ex.type === 'fill' && ex.language === 'shell' && first && first in cliSpecs)
        commands.push([first, ex.solution.answer!])
      if (ex.type === 'editor') {
        for (const a of ex.assertions)
          try {
            parsePath(a.path)
          } catch (e) {
            problems.push(`${where} [${ex.id}]: ${(e as Error).message}`)
          }
        // La solución de referencia debe pasar todas sus comprobaciones.
        if (!ex.solution.answer) problems.push(`${where} [${ex.id}]: los ejercicios de editor necesitan solution.answer`)
        else if (ex.language === 'yaml') {
          const r = gradeYaml(ex.solution.answer, ex.assertions)
          if (!r.correct)
            problems.push(
              `${where} [${ex.id}]: la solución no pasa sus comprobaciones: ${r.feedback ?? r.checks.filter((c) => !c.ok).map((c) => c.message).join('; ')}`,
            )
        }
      }
      for (const [cli, cmd] of commands) {
        const r = parseCommand(cliSpecs[cli as keyof CliSpecs]!, cmd)
        if (!r.ok) problems.push(`${where} [${ex.id}]: "${cmd}" no es válido: ${r.errors.join('; ')}`)
      }
    }
    const ids = mod.exercises.map((e) => e.id)
    const dup = ids.find((x, i) => ids.indexOf(x) !== i)
    if (dup) problems.push(`content/${mod.ref}/exercises.json: id de ejercicio repetido "${dup}"`)
  }

  const glossary = glossaryRes.success ? glossaryRes.data.entries : []
  for (const g of glossary)
    if (!byRef.has(g.introducedIn))
      problems.push(`content/glossary.json: "${g.term}" apunta a un módulo inexistente (${g.introducedIn})`)

  if (problems.length) throw new ContentError(problems)

  modules.sort((a, b) => a.level - b.level || a.order - b.order)
  return { tracks, modules, glossary }
}

/** Lo que va siempre en el bundle inicial (común a la app y a los tests). */
export function loadBaseContent(): Pick<RawContent, 'tracks' | 'glossary' | 'modules' | 'flashcards'> {
  return {
    tracks: import.meta.glob('/content/tracks.json', { eager: true, import: 'default' })['/content/tracks.json'],
    glossary: import.meta.glob('/content/glossary.json', { eager: true, import: 'default' })['/content/glossary.json'],
    modules: import.meta.glob('/content/*/*/module.json', { eager: true, import: 'default' }),
    flashcards: import.meta.glob('/content/*/*/flashcards.json', { eager: true, import: 'default' }),
  }
}

/**
 * Contenido para la app: lecciones solo con su frontmatter y ejercicios solo con
 * id y tipo (plugins lesson-meta y exercise-meta de vite.config.ts).
 */
function loadAppContent(): RawContent {
  return {
    ...loadBaseContent(),
    lessons: import.meta.glob('/content/*/*/lessons/*.md', { eager: true, query: '?lesson-meta', import: 'default' }) as Record<
      string,
      string
    >,
    exercises: import.meta.glob('/content/*/*/exercises.json', { eager: true, query: '?exercise-meta', import: 'default' }),
    cliSpecs: {},
  }
}

let cached: Catalog | null = null
export function getCatalog(): Catalog {
  cached ??= buildCatalog(loadAppContent(), { full: false })
  return cached
}

/**
 * Anota en la promesa su resultado con los campos `status`/`value` que lee `use()`
 * de React: si ya se resolvió (precarga, visita anterior), se pinta sin suspender.
 */
function track<T>(p: Promise<T>): Promise<T> {
  const t = p as Promise<T> & { status?: string; value?: T; reason?: unknown }
  t.status = 'pending'
  p.then(
    (value) => Object.assign(t, { status: 'fulfilled', value }),
    (reason) => Object.assign(t, { status: 'rejected', reason }),
  )
  return p
}

// Ejercicios completos: un chunk por módulo, descargado al practicar o examinarse.
const exerciseSources = import.meta.glob('/content/*/*/exercises.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
const exerciseCache = new Map<string, Promise<Exercise[]>>()

// Especificaciones de CLI: un chunk por CLI. Una vez cargadas se leen de forma
// síncrona con getCliSpec (autocompletado y corrección).
const specSources = import.meta.glob('/content/cli-specs/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
const specCache = new Map<string, Promise<CliSpec | undefined>>()
const loadedSpecs: CliSpecs = {}

/** Especificación ya cargada (undefined si aún no se ha pedido con loadCliSpec). */
export function getCliSpec(cli: string): CliSpec | undefined {
  return loadedSpecs[cli as CliSpec['cli']]
}

export function loadCliSpec(cli: string): Promise<CliSpec | undefined> {
  let p = specCache.get(cli)
  if (!p) {
    const load = specSources[`/content/cli-specs/${cli}.json`]
    p = load
      ? load().then((data) => {
          const spec = CliSpecSchema.parse(data)
          loadedSpecs[spec.cli] = spec
          return spec
        })
      : Promise.resolve(undefined)
    specCache.set(cli, p)
  }
  return p
}

/** CLI cuya especificación necesita un ejercicio (terminal o hueco de comando). */
export function cliOf(ex: Exercise): string | undefined {
  if (ex.type === 'command') return ex.cli
  if (ex.type === 'fill' && ex.language === 'shell') return ex.template.trim().split(/\s+/)[0]
  return undefined
}

/** Carga las especificaciones de CLI que usan estos ejercicios. */
export async function loadCliSpecsFor(exercises: Exercise[]): Promise<void> {
  const clis = new Set(exercises.map(cliOf).filter((c): c is string => !!c))
  await Promise.all([...clis].map(loadCliSpec))
}

/**
 * Ejercicios completos del módulo, con sus especificaciones de CLI ya cargadas.
 * La promesa se cachea: sirve para `use()` de React.
 */
export function loadExercises(mod: Module): Promise<Exercise[]> {
  const path = mod.exercisesPath
  if (!path) return Promise.resolve([])
  let p = exerciseCache.get(path)
  if (!p) {
    const source = mod.fullExercises
      ? Promise.resolve(mod.fullExercises)
      : (exerciseSources[path]?.() ?? Promise.reject(new Error(`Ejercicios no encontrados: ${path}`))).then(
          (data) => ExercisesFileSchema.parse(data).exercises,
        )
    p = track(
      source.then(async (exercises) => {
        await loadCliSpecsFor(exercises)
        return exercises
      }),
    )
    exerciseCache.set(path, p)
  }
  return p
}

// Cuerpos de las lecciones: un chunk por archivo, descargado al abrir la lección.
const lessonSources = import.meta.glob('/content/*/*/lessons/*.md', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>
const bodies = new Map<string, Promise<string>>()

/** Cuerpo de la lección (sin frontmatter). La promesa se cachea: sirve para `use()` de React. */
export function loadLessonBody(lesson: Lesson): Promise<string> {
  if (lesson.body !== undefined) return Promise.resolve(lesson.body)
  let p = bodies.get(lesson.path)
  if (!p) {
    const load = lessonSources[lesson.path]
    p = load ? load().then((src) => parseLesson(src).body) : Promise.reject(new Error(`Lección no encontrada: ${lesson.path}`))
    bodies.set(lesson.path, p)
  }
  return p
}

export function findModule(catalog: Catalog, trackId: string, slug: string): Module | undefined {
  return catalog.modules.find((m) => m.trackId === trackId && m.slug === slug)
}
