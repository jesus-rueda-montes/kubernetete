import { loadAll, YAMLException } from 'js-yaml'

// Corrección estática de YAML: se parsea el documento y se comprueban
// aserciones sobre rutas. Nada se ejecuta.
//
// Sintaxis de rutas:
//   metadata.name                   clave anidada
//   spec.containers[0].image        índice de lista
//   spec.containers[*].image        todos los elementos
//   spec.containers[name=web].image elementos cuyo campo "name" vale "web"

export type Segment =
  | { kind: 'key'; key: string }
  | { kind: 'index'; index: number }
  | { kind: 'all' }
  | { kind: 'filter'; key: string; value: string }

export type AssertOp = 'exists' | 'absent' | 'equals' | 'matches' | 'oneOf' | 'count' | 'hasKeys'

export interface Assertion {
  path: string
  op: AssertOp
  value?: unknown
  message: string
}

export interface CheckResult {
  message: string
  ok: boolean
}

export function parsePath(path: string): Segment[] {
  const segments: Segment[] = []
  const re = /([^.[\]]+)|\[([^\]]*)\]|(\.)/g
  let expectKey = true
  let consumed = 0
  for (const m of path.matchAll(re)) {
    if (m.index !== consumed) throw new Error(`ruta inválida: "${path}"`)
    consumed = m.index + m[0].length
    if (m[1] !== undefined) {
      if (!expectKey) throw new Error(`ruta inválida: "${path}" (falta un punto antes de "${m[1]}")`)
      segments.push({ kind: 'key', key: m[1] })
      expectKey = false
    } else if (m[2] !== undefined) {
      const inner = m[2]
      const quoted = /^'([^']+)'$|^"([^"]+)"$/.exec(inner)
      // ['clave.con/puntos']: claves que contienen "." o "/" (annotations, labels con prefijo).
      if (quoted) segments.push({ kind: 'key', key: quoted[1] ?? quoted[2] })
      else if (inner === '*') segments.push({ kind: 'all' })
      else if (/^\d+$/.test(inner)) segments.push({ kind: 'index', index: Number(inner) })
      else if (/^[A-Za-z0-9_-]+=.+$/.test(inner)) {
        const eq = inner.indexOf('=')
        segments.push({ kind: 'filter', key: inner.slice(0, eq), value: inner.slice(eq + 1) })
      } else throw new Error(`ruta inválida: "${path}" (corchete "[${inner}]" no reconocido)`)
      expectKey = false
    } else {
      if (expectKey) throw new Error(`ruta inválida: "${path}" (punto de más)`)
      expectKey = true
    }
  }
  if (consumed !== path.length || segments.length === 0 || expectKey)
    throw new Error(`ruta inválida: "${path}"`)
  return segments
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Todos los valores que alcanza la ruta (vacío si no existe). */
export function resolve(root: unknown, path: string): unknown[] {
  let current: unknown[] = [root]
  for (const seg of parsePath(path)) {
    const next: unknown[] = []
    for (const v of current) {
      if (seg.kind === 'key') {
        if (isObject(v) && seg.key in v) next.push(v[seg.key])
      } else if (Array.isArray(v)) {
        if (seg.kind === 'index') {
          if (seg.index < v.length) next.push(v[seg.index])
        } else if (seg.kind === 'all') next.push(...v)
        else next.push(...v.filter((el) => isObject(el) && String(el[seg.key]) === seg.value))
      }
    }
    current = next
  }
  return current
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a)
    return ka.length === Object.keys(b).length && ka.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

const present = (v: unknown) => v !== undefined && v !== null

export function check(root: unknown, a: Assertion): boolean {
  const values = resolve(root, a.path)
  switch (a.op) {
    case 'exists':
      return values.length > 0 && values.every(present)
    case 'absent':
      return values.every((v) => !present(v))
    case 'equals':
      return values.length > 0 && values.every((v) => deepEqual(v, a.value))
    case 'matches': {
      const re = new RegExp(String(a.value))
      return values.length > 0 && values.every((v) => (typeof v === 'string' || typeof v === 'number') && re.test(String(v)))
    }
    case 'oneOf':
      return values.length > 0 && values.every((v) => (a.value as unknown[]).some((x) => deepEqual(v, x)))
    case 'hasKeys':
      // Mapa que contiene esas claves, aunque su valor sea vacío (p. ej. "web:" en children de un inventario).
      return values.length > 0 && values.every((v) => isObject(v) && (a.value as string[]).every((k) => k in v))
    case 'count': {
      const n = values.length === 1 && Array.isArray(values[0]) ? values[0].length : values.length
      return n === a.value
    }
  }
}

// Mensajes más frecuentes de js-yaml, explicados en español. Si llega uno que
// no está aquí, se muestra el original en inglés.
const REASONS: [RegExp, string][] = [
  [/tab characters must not be used in indentation/, 'no se pueden usar tabuladores para indentar, usa espacios'],
  [/bad indentation of a (mapping|sequence) entry/, 'la indentación no cuadra: revisa que los elementos del mismo nivel empiecen en la misma columna'],
  [/duplicated mapping key/, 'hay una clave repetida en el mismo nivel'],
  [/end of the stream or a document separator is expected/, 'sobra contenido o la indentación no es coherente con las líneas anteriores'],
  [/can not read a block mapping entry; a multiline key may not be an implicit key/, 'no se puede leer una clave: ¿falta ":" o hay un salto de indentación?'],
  [/unexpected end of the stream within a (flow collection|double quoted scalar|single quoted scalar)/, 'falta cerrar unas comillas, una llave { o un corchete ['],
  [/missed comma between flow collection entries/, 'falta una coma entre elementos de { } o [ ]'],
  [/incomplete explicit mapping pair; a key node is missed/, 'hay un ":" sin clave delante'],
]

function translateReason(reason: string): string {
  return REASONS.find(([re]) => re.test(reason))?.[1] ?? reason
}

export type YamlParse ={ ok: true; doc: unknown } | { ok: false; error: string }

export function parseYaml(source: string): YamlParse {
  try {
    const docs = loadAll(source).filter((d) => d !== null && d !== undefined)
    if (docs.length === 0) return { ok: false, error: 'El documento está vacío.' }
    if (docs.length > 1) return { ok: false, error: 'Se esperaba un único documento YAML (sin separadores ---).' }
    return { ok: true, doc: docs[0] }
  } catch (e) {
    if (e instanceof YAMLException) {
      const line = e.mark ? ` en la línea ${e.mark.line + 1}` : ''
      const reason = translateReason(e.reason)
      const tabs = /\t/.test(source) && !/tabuladores/.test(reason) ? ' Ojo: YAML no admite tabuladores para indentar, usa espacios.' : ''
      return { ok: false, error: `Error de sintaxis YAML${line}: ${reason}.${tabs}` }
    }
    throw e
  }
}

export interface YamlGrade {
  correct: boolean
  checks: CheckResult[]
  feedback?: string
}

export function gradeYaml(source: string, assertions: Assertion[]): YamlGrade {
  const parsed = parseYaml(source)
  if (!parsed.ok) return { correct: false, checks: [], feedback: parsed.error }
  const checks = assertions.map((a) => ({ message: a.message, ok: check(parsed.doc, a) }))
  return { correct: checks.every((c) => c.ok), checks }
}
