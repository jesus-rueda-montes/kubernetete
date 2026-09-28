import type { Node } from 'web-tree-sitter'
import { check, type Assertion, type CheckResult } from './yamlAssert'

// Lectura estática de HCL (Terraform) con tree-sitter. El árbol se convierte a
// la misma forma que usa el JSON de Terraform (hcl2json):
//
//   resource "google_storage_bucket" "logs" { name = "x" }
//   → { resource: { google_storage_bucket: { logs: [ { name: "x" } ] } } }
//
// Así las aserciones usan la misma sintaxis de rutas que en YAML:
//   resource.google_storage_bucket.logs[0].name
//
// Las expresiones que no son literales (var.region, funciones, referencias...)
// se guardan como su texto fuente: "var.region".

export type HclParse = { ok: true; doc: Record<string, unknown> } | { ok: false; error: string }

export interface HclParser {
  parse(source: string): HclParse
}

export interface HclWasm {
  /** Ruta/URL del runtime web-tree-sitter.wasm (en navegador). */
  runtime?: string
  /** Gramática: URL/ruta o los bytes del .wasm. */
  grammar: string | Uint8Array
}

export async function createHclParser(wasm: HclWasm): Promise<HclParser> {
  // Import dinámico: web-tree-sitter solo se descarga al corregir HCL.
  const { Language, Parser } = await import('web-tree-sitter')
  await Parser.init(wasm.runtime ? { locateFile: () => wasm.runtime! } : undefined)
  const language = await Language.load(wasm.grammar)
  const parser = new Parser()
  parser.setLanguage(language)
  return {
    parse(source) {
      const tree = parser.parse(source)
      if (!tree) return { ok: false, error: 'No se pudo analizar el código.' }
      try {
        const root = tree.rootNode
        if (root.hasError) return { ok: false, error: describeError(root, source) }
        const body = root.namedChildren.find((n) => n?.type === 'body')
        const errors: string[] = []
        const doc = body ? bodyToObject(body, errors) : {}
        if (errors.length) return { ok: false, error: errors[0] }
        if (Object.keys(doc).length === 0) return { ok: false, error: 'El archivo está vacío.' }
        return { ok: true, doc }
      } finally {
        tree.delete()
      }
    },
  }
}

// --- Conversión del árbol ------------------------------------------------------

const named = (n: Node): Node[] => n.namedChildren.filter((c): c is Node => !!c && c.type !== 'comment')

function unescape(s: string): string {
  return s.replace(/\\(["\\nt])/g, (_, c: string) => ({ n: '\n', t: '\t' })[c] ?? c)
}

function stringValue(n: Node): string {
  return unescape(
    named(n)
      .filter((c) => c.type === 'template_literal')
      .map((c) => c.text)
      .join(''),
  )
}

function exprValue(n: Node): unknown {
  const kids = named(n)
  if (n.type === 'expression' && kids.length === 1) return exprValue(kids[0])
  switch (n.type) {
    case 'literal_value':
      return exprValue(kids[0])
    case 'numeric_lit':
      return Number(n.text)
    case 'bool_lit':
      return n.text === 'true'
    case 'null_lit':
      return null
    case 'string_lit':
      return stringValue(n)
    case 'collection_value':
      return exprValue(kids[0])
    case 'tuple':
      return kids.filter((k) => k.type === 'expression').map(exprValue)
    case 'object': {
      const obj: Record<string, unknown> = {}
      for (const el of kids.filter((k) => k.type === 'object_elem')) {
        const key = el.childForFieldName('key')
        const val = el.childForFieldName('val')
        if (!key || !val) continue
        const keyKids = named(key)
        const keyName = keyKids.length === 1 && keyKids[0].type === 'variable_expr' ? keyKids[0].text : String(exprValue(key))
        obj[keyName] = exprValue(val)
      }
      return obj
    }
    case 'template_expr': {
      const q = kids[0]
      if (q?.type === 'quoted_template') {
        const parts = named(q)
        return parts.every((p) => p.type === 'template_literal') ? unescape(parts.map((p) => p.text).join('')) : q.text.slice(1, -1)
      }
      return n.text
    }
    default:
      // Referencias, funciones, operaciones... se comparan por su texto.
      return n.text
  }
}

function bodyToObject(body: Node, errors: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const attrs = new Set<string>()
  for (const child of named(body)) {
    if (child.type === 'attribute') {
      const [id, expr] = named(child)
      const name = id.text
      if (attrs.has(name))
        errors.push(`Atributo repetido en la línea ${child.startPosition.row + 1}: "${name}" ya está definido en este bloque.`)
      attrs.add(name)
      obj[name] = expr ? exprValue(expr) : null
    } else if (child.type === 'block') {
      const parts = named(child)
      const type = parts[0].text
      const labels = parts.slice(1).filter((p) => p.type === 'string_lit' || p.type === 'identifier')
      const inner = parts.find((p) => p.type === 'body')
      const value = inner ? bodyToObject(inner, errors) : {}
      // Anidar por etiquetas; el último nivel es una lista (puede repetirse).
      const keys = [type, ...labels.map((l) => (l.type === 'string_lit' ? stringValue(l) : l.text))]
      let target = obj
      for (const k of keys.slice(0, -1)) {
        if (typeof target[k] !== 'object' || target[k] === null || Array.isArray(target[k])) target[k] = {}
        target = target[k] as Record<string, unknown>
      }
      const last = keys[keys.length - 1]
      target[last] = [...(Array.isArray(target[last]) ? (target[last] as unknown[]) : []), value]
    }
  }
  return obj
}

// --- Errores de sintaxis ---------------------------------------------------------

// Qué falta, como frase completa. Las claves son el tipo del nodo "MISSING"
// que genera tree-sitter (a veces el propio símbolo).
const MISSING: Record<string, string> = {
  '}': 'falta "}" para cerrar un bloque o un mapa',
  block_end: 'falta "}" para cerrar el bloque',
  object_end: 'falta "}" para cerrar el mapa',
  ']': 'falta "]" para cerrar la lista',
  tuple_end: 'falta "]" para cerrar la lista',
  '"': 'faltan las comillas de cierre (")',
  quoted_template_end: 'faltan las comillas de cierre (")',
  identifier: 'falta un nombre',
  expression: 'falta un valor después de "="',
}

function firstProblem(n: Node): Node | null {
  if (n.isMissing || n.type === 'ERROR') return n
  for (const c of n.children) {
    if (c && (c.hasError || c.isMissing)) {
      const found = firstProblem(c)
      if (found) return found
    }
  }
  return null
}

function describeError(root: Node, source: string): string {
  const p = firstProblem(root)
  if (!p) return 'Error de sintaxis HCL.'
  const line = p.startPosition.row + 1
  const col = p.startPosition.column + 1
  const where = `Error de sintaxis HCL en la línea ${line}, columna ${col}`
  if (p.isMissing) return `${where}: ${MISSING[p.type] ?? `falta "${p.type}"`}.`

  const lines = source.split('\n')
  const srcLine = lines[p.startPosition.row] ?? ''
  const prevLine = lines
    .slice(0, p.startPosition.row)
    .reverse()
    .find((l) => l.trim() !== '')
  const hints: string[] = []
  // Cabecera de bloque sin "{": resource "tipo" "nombre"  ← falta la llave
  if (prevLine && /^\s*[A-Za-z_][\w-]*(\s+("[^"]*"|[A-Za-z_][\w-]*))*\s*$/.test(prevLine))
    hints.push(`¿Falta "{" al final de «${prevLine.trim()}»?`)
  // Error típico viniendo de YAML/JSON: usar ":" para asignar.
  if (/^\s*[A-Za-z_][\w-]*\s*:/.test(srcLine)) hints.push('En HCL los atributos se asignan con "=", no con ":".')
  if (/^\s*[A-Za-z_][\w-]*\s*=\s*$/.test(srcLine)) hints.push('Falta el valor después de "=".')
  const snippet = p.text.trim().split('\n')[0].slice(0, 30)
  return `${where}${snippet ? `, cerca de «${snippet}»` : ''}.${hints.length ? ' ' + hints.join(' ') : ''}`
}

// --- Corrección --------------------------------------------------------------------

export interface HclGrade {
  correct: boolean
  checks: CheckResult[]
  feedback?: string
}

export function gradeHcl(parser: HclParser, source: string, assertions: Assertion[]): HclGrade {
  const parsed = parser.parse(source)
  if (!parsed.ok) return { correct: false, checks: [], feedback: parsed.error }
  const checks = assertions.map((a) => ({ message: a.message, ok: check(parsed.doc, a) }))
  return { correct: checks.every((c) => c.ok), checks }
}
