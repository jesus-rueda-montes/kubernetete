import { describe, expect, test } from 'vitest'
import { glossaryForTrack, glossaryPattern } from './glossaryPlugin'
import { checkSections, parseLesson, REQUIRED_SECTIONS } from './lesson'
import { buildCatalog, ContentError, getCatalog, getCliSpec, loadExercises, loadLessonBody, type RawContent } from './loader'
import { loadRawContent } from './rawContent'

// Valida TODO el contenido real de /content. Si falla, el mensaje lista
// cada archivo y campo con problemas.
test('todo el contenido de /content es válido', () => {
  try {
    const catalog = buildCatalog(loadRawContent())
    expect(catalog.tracks.length).toBeGreaterThan(0)
    expect(catalog.modules.length).toBeGreaterThan(0)
  } catch (e) {
    if (e instanceof ContentError) throw new Error(e.message)
    throw e
  }
})

test('la app carga solo el frontmatter y el cuerpo de cada lección bajo demanda', async () => {
  const lesson = getCatalog().modules.find((m) => m.ref === 'kubernetes/l1-pods')!.lessons[0]
  expect(lesson.frontmatter.title).toBe('¿Qué es un Pod?')
  expect(lesson.body).toBeUndefined()
  const body = await loadLessonBody(lesson)
  expect(body.startsWith('## Qué problema resuelve')).toBe(true)
  expect(loadLessonBody(lesson)).toBe(loadLessonBody(lesson)) // promesa cacheada (necesario para use())
})

test('la app carga los ejercicios completos y las specs de CLI bajo demanda', async () => {
  const mod = getCatalog().modules.find((m) => m.ref === 'kubernetes/l1-arquitectura')!
  expect(mod.fullExercises).toBeUndefined()
  expect(mod.exercises.find((e) => e.id === 'listar-nodes')).toEqual({ id: 'listar-nodes', type: 'command' })
  const exercises = await loadExercises(mod)
  expect(exercises.find((e) => e.id === 'listar-nodes')?.type).toBe('command')
  expect(getCliSpec('kubectl')?.cli).toBe('kubectl') // cargada junto con los ejercicios
  expect(loadExercises(mod)).toBe(loadExercises(mod)) // promesa cacheada (necesario para use())
})

// Texto de la lección que el plugin del glosario recorre: sin código, títulos ni enlaces.
const prose = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/^#.*$/gm, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')

describe('glosario', () => {
  const catalog = buildCatalog(loadRawContent())
  const order = new Map(catalog.modules.map((m, i) => [m.ref, i])) // ya ordenados por nivel y orden

  /** Términos que el plugin marcaría en cada módulo (misma expresión y mismo filtro por itinerario). */
  const used = new Map<string, Set<string>>()
  for (const mod of catalog.modules) {
    const entries = glossaryForTrack(catalog.glossary, mod.trackId)
    const re = glossaryPattern(entries.map((e) => e.term).sort((a, b) => b.length - a.length))
    const found = new Set<string>()
    for (const lesson of mod.lessons) for (const m of prose(lesson.body ?? '').matchAll(re)) found.add(m[1])
    used.set(mod.ref, found)
  }

  test('no hay términos repetidos', () => {
    const terms = catalog.glossary.map((g) => g.term)
    expect(terms.filter((t, i) => terms.indexOf(t) !== i)).toEqual([])
  })

  test('cada término se usa en el módulo donde dice presentarse', () => {
    const missing = catalog.glossary.filter((g) => !used.get(g.introducedIn)?.has(g.term)).map((g) => `${g.term} (${g.introducedIn})`)
    expect(missing).toEqual([])
  })

  // Dentro de su itinerario, ningún módulo anterior usa el término antes de
  // presentarlo. En otros itinerarios (paralelos) el tooltip aporta la definición.
  test('ningún módulo anterior de su itinerario usa el término antes de presentarlo', () => {
    const early: string[] = []
    for (const g of catalog.glossary) {
      const track = g.introducedIn.split('/')[0]
      for (const mod of catalog.modules)
        if (mod.trackId === track && order.get(mod.ref)! < order.get(g.introducedIn)! && used.get(mod.ref)!.has(g.term))
          early.push(`${g.term}: se usa en ${mod.ref} antes de ${g.introducedIn}`)
    }
    expect(early).toEqual([])
  })

  test('el plugin respeta plurales, límites de palabra y nombres con punto', () => {
    const re = glossaryPattern(['Node', 'Pod'])
    expect([...'Pods y Node, no Node.js ni iPod'.matchAll(re)].map((m) => m[0])).toEqual(['Pods', 'Node'])
  })

  test('los términos trackOnly solo se marcan en su itinerario', () => {
    const service = catalog.glossary.find((g) => g.term === 'Service')!
    expect(service.trackOnly).toBe(true)
    expect(glossaryForTrack(catalog.glossary, 'kubernetes')).toContain(service)
    expect(glossaryForTrack(catalog.glossary, 'cloud')).not.toContain(service)
  })
})

const fullBody = REQUIRED_SECTIONS.map((s) => `## ${s}\n\ntexto`).join('\n\n')
const lessonSrc = (body: string) => `---\ntitle: Test\nminutes: 5\n---\n\n${body}`

describe('lecciones', () => {
  test('parsea frontmatter y cuerpo', () => {
    const l = parseLesson(lessonSrc(fullBody))
    expect(l.frontmatter).toEqual({ title: 'Test', minutes: 5 })
    expect(l.body.startsWith('## Qué problema resuelve')).toBe(true)
  })

  test('sin frontmatter lanza error', () => {
    expect(() => parseLesson('# hola')).toThrow(/frontmatter/)
  })

  test('detecta secciones que faltan y fuera de orden', () => {
    expect(checkSections(fullBody)).toEqual([])
    expect(checkSections(fullBody.replace('## Analogía', '## Otra'))).toEqual(['falta la sección "Analogía"'])
    const swapped = fullBody.replace('## Analogía', '## TMP').replace('## Concepto', '## Analogía').replace('## TMP', '## Concepto')
    expect(checkSections(swapped).length).toBeGreaterThan(0)
  })
})

describe('buildCatalog detecta errores', () => {
  const base = (): RawContent => ({
    tracks: { tracks: [{ id: 'k8s', title: 'K8s', description: 'd' }] },
    glossary: { entries: [] },
    modules: {
      '/content/k8s/m1/module.json': { title: 'M1', summary: 's', level: 1, order: 1, xp: 10 },
    },
    lessons: { '/content/k8s/m1/lessons/01-a.md': lessonSrc(fullBody) },
    exercises: {},
    flashcards: {},
    cliSpecs: {},
  })

  test('contenido mínimo válido', () => {
    const c = buildCatalog(base())
    expect(c.modules[0]).toMatchObject({ ref: 'k8s/m1', trackId: 'k8s', slug: 'm1', prereqs: [] })
    expect(c.modules[0].lessons[0].id).toBe('01-a')
  })

  test('prerequisito inexistente e itinerario desconocido', () => {
    const raw = base()
    raw.modules['/content/k8s/m1/module.json'] = { title: 'M1', summary: 's', level: 1, order: 1, xp: 10, prereqs: ['k8s/nada'] }
    raw.modules['/content/otro/m2/module.json'] = { title: 'M2', summary: 's', level: 1, order: 1, xp: 10 }
    raw.lessons['/content/otro/m2/lessons/01-b.md'] = lessonSrc(fullBody)
    let msg = ''
    try { buildCatalog(raw) } catch (e) { msg = (e as Error).message }
    expect(msg).toMatch(/prerequisito "k8s\/nada" no existe/)
    expect(msg).toMatch(/itinerario "otro" no existe/)
  })

  test('quiz single con dos correctas y hueco no declarado', () => {
    const raw = base()
    raw.exercises['/content/k8s/m1/exercises.json'] = {
      exercises: [
        {
          id: 'q', type: 'quiz', mode: 'single', prompt: 'p', hints: ['h'], solution: { explanation: 'e' },
          options: [
            { id: 'a', text: 'a', correct: true, explanation: 'x' },
            { id: 'b', text: 'b', correct: true, explanation: 'x' },
          ],
        },
        {
          id: 'f', type: 'fill', language: 'shell', prompt: 'p', hints: ['h'], solution: { explanation: 'e' },
          template: 'kubectl {{verbo}} {{otro}}', blanks: [{ id: 'verbo', accepted: ['get'] }],
        },
      ],
    }
    let msg = ''
    try { buildCatalog(raw) } catch (e) { msg = (e as Error).message }
    expect(msg).toMatch(/exactamente 1 opción correcta/)
    expect(msg).toMatch(/\{\{otro\}\} sin declararlo/)
  })

  test('más de 3 pistas no se permite', () => {
    const raw = base()
    raw.exercises['/content/k8s/m1/exercises.json'] = {
      exercises: [{
        id: 'c', type: 'command', cli: 'kubectl', prompt: 'p', accepted: ['kubectl get pods'],
        hints: ['1', '2', '3', '4'], solution: { explanation: 'e' },
      }],
    }
    expect(() => buildCatalog(raw)).toThrow(ContentError)
  })
})
