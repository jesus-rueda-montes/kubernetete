import type { CliCommand, CliFlag, CliSpec } from '../content/schema'

// Motor de comandos: tokenizar, interpretar según la especificación de la CLI,
// comparar comandos de forma semántica y autocompletar. Todo puro.

export interface Token {
  value: string
  start: number
  end: number
}

/** Divide una línea como lo haría una shell sencilla (respeta comillas simples y dobles). */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++
    if (i >= line.length) break
    const start = i
    let value = ''
    let quote: string | null = null
    while (i < line.length && (quote || !/\s/.test(line[i]))) {
      const ch = line[i]
      if (quote) {
        if (ch === quote) quote = null
        else value += ch
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else {
        value += ch
      }
      i++
    }
    tokens.push({ value, start, end: i })
  }
  return tokens
}

export interface ParsedCommand {
  /** Ruta canónica: ["kubectl", "get"]. */
  path: string[]
  /** Posicionales, con alias normalizados (po -> pods). */
  positionals: string[]
  /** Flags por nombre largo; los booleanos valen "true". */
  flags: Record<string, string>
  /** Lo que va tras "--" (p. ej. el comando de kubectl exec). */
  trailing: string[]
}

interface WalkState extends ParsedCommand {
  node: CliCommand
  pendingFlag: CliFlag | null
  afterDoubleDash: boolean
  errors: string[]
  dash: string
}

const rootOf = (spec: CliSpec): CliCommand => ({
  name: spec.cli,
  description: spec.description,
  args: spec.args,
  subcommands: spec.commands,
})

// Primero los del subcomando (más relevantes y con prioridad si un corto coincide), luego los globales.
const availableFlags = (spec: CliSpec, node: CliCommand): CliFlag[] => [...(node.flags ?? []), ...spec.globalFlags]

/** Prefijo de los flags largos según el estilo de la CLI: "--name" o "-name". */
export const flagPrefix = (spec: CliSpec) => (spec.flagStyle === 'single-dash' ? '-' : '--')

const expectsSubcommand = (node: CliCommand, positionals: string[]) =>
  !!node.subcommands?.length && !node.args?.length && positionals.length === 0

function setFlag(state: WalkState, flag: CliFlag, value: string) {
  if (flag.strict && flag.values && !flag.values.includes(value))
    state.errors.push(`valor no válido para ${state.dash}${flag.name}: "${value}" (válidos: ${flag.values.join(', ')})`)
  state.flags[flag.name] = value
}

/** Recorre los tokens (sin el nombre de la CLI) y acumula estado y errores. */
function walk(spec: CliSpec, tokens: string[]): WalkState {
  const root = rootOf(spec)
  const state: WalkState = {
    node: root,
    path: [spec.cli],
    positionals: [],
    flags: {},
    trailing: [],
    pendingFlag: null,
    afterDoubleDash: false,
    errors: [],
    dash: flagPrefix(spec),
  }

  const dash = state.dash
  for (const raw of tokens) {
    const flags = availableFlags(spec, state.node)
    // En estilo single-dash (Go), "-name" y "--name" son el mismo flag largo.
    const t = dash === '-' && /^--?[^-]/.test(raw) && !state.afterDoubleDash && !state.pendingFlag ? `--${raw.replace(/^--?/, '')}` : raw
    if (state.afterDoubleDash) {
      state.trailing.push(t)
    } else if (state.pendingFlag) {
      setFlag(state, state.pendingFlag, t)
      state.pendingFlag = null
    } else if (t === '--') {
      state.afterDoubleDash = true
    } else if (t.startsWith('--')) {
      const eq = t.indexOf('=')
      const name = eq === -1 ? t.slice(2) : t.slice(2, eq)
      const value = eq === -1 ? undefined : t.slice(eq + 1)
      const flag = flags.find((f) => f.name === name)
      if (!flag) state.errors.push(`flag desconocido: ${dash}${name}`)
      else if (flag.takesValue) {
        if (value === undefined) state.pendingFlag = flag
        else setFlag(state, flag, value)
      } else if (value === undefined || value === 'true') state.flags[flag.name] = 'true'
      else if (value === 'false') delete state.flags[flag.name]
      else state.errors.push(`${dash}${name} no admite valor ("${value}")`)
    } else if (t.startsWith('-') && t.length > 1) {
      const body = t.slice(1)
      const first = flags.find((f) => f.short === body[0])
      if (first?.takesValue) {
        const rest = body.slice(1).replace(/^=/, '')
        if (rest) setFlag(state, first, rest)
        else state.pendingFlag = first
      } else {
        // Uno o varios flags booleanos cortos juntos: -it == -i -t
        for (const ch of body) {
          const f = flags.find((x) => x.short === ch)
          if (!f) state.errors.push(`flag desconocido: -${ch}`)
          else if (f.takesValue) state.errors.push(`-${ch} necesita un valor y no puede ir agrupado`)
          else state.flags[f.name] = 'true'
        }
      }
    } else if (expectsSubcommand(state.node, state.positionals)) {
      const sub = state.node.subcommands!.find((c) => c.name === t || c.aliases?.includes(t))
      if (!sub) {
        state.errors.push(`comando desconocido para ${state.path.join(' ')}: "${t}"`)
        state.positionals.push(t)
      } else {
        state.node = sub
        state.path.push(sub.name)
      }
    } else {
      const arg = state.node.args?.[state.positionals.length]
      const set = arg?.valueSet ? spec.valueSets[arg.valueSet] : undefined
      const slash = t.indexOf('/')
      const typed = set && slash > 0 ? set.find((v) => [v.value, ...(v.aliases ?? [])].includes(t.slice(0, slash))) : undefined
      if (typed && state.node.args?.[state.positionals.length + 1]) {
        // Forma TIPO/NOMBRE de kubectl: "deploy/web" equivale a "deployments web".
        state.positionals.push(typed.value, t.slice(slash + 1))
      } else if (set) {
        const item = set.find((v) => v.value === t || v.aliases?.includes(t))
        if (!item) state.errors.push(`${arg!.name.toLowerCase()} desconocido: "${t}"`)
        state.positionals.push(item?.value ?? t)
      } else {
        state.positionals.push(t)
      }
    }
  }
  return state
}

export type ParseResult = { ok: true; command: ParsedCommand } | { ok: false; errors: string[] }

export function parseCommand(spec: CliSpec, line: string): ParseResult {
  const tokens = tokenize(line).map((t) => t.value)
  if (tokens.length === 0) return { ok: false, errors: ['el comando está vacío'] }
  if (tokens[0] !== spec.cli) return { ok: false, errors: [`el comando debe empezar por "${spec.cli}"`] }
  const s = walk(spec, tokens.slice(1))
  const errors = [...s.errors]
  if (s.pendingFlag) errors.push(`el flag ${s.dash}${s.pendingFlag.name} necesita un valor`)
  if (s.path.length === 1 && spec.commands.length > 0 && !spec.args?.length) errors.push(`falta el subcomando (p. ej. ${spec.commands.slice(0, 3).map((c) => c.name).join(', ')})`)
  if (errors.length) return { ok: false, errors }
  return { ok: true, command: { path: s.path, positionals: s.positionals, flags: s.flags, trailing: s.trailing } }
}

/** Igualdad semántica: el orden de los flags y la forma corta/larga no importan. */
export function sameCommand(a: ParsedCommand, b: ParsedCommand): boolean {
  const flagKey = (f: Record<string, string>) => JSON.stringify(Object.entries(f).sort(([x], [y]) => x.localeCompare(y)))
  return (
    a.path.join(' ') === b.path.join(' ') &&
    a.positionals.join('\u0000') === b.positionals.join('\u0000') &&
    a.trailing.join('\u0000') === b.trailing.join('\u0000') &&
    flagKey(a.flags) === flagKey(b.flags)
  )
}

// --- Autocompletado ----------------------------------------------------------

export interface Candidate {
  value: string
  description?: string
}

export interface Completion {
  /** Posición donde empieza el token que se está completando. */
  start: number
  partial: string
  candidates: Candidate[]
}

export function complete(spec: CliSpec, line: string): Completion {
  const tokens = tokenize(line)
  const atNewToken = line.length === 0 || /\s$/.test(line)
  const partialTok = atNewToken ? undefined : tokens[tokens.length - 1]
  const partial = partialTok?.value ?? ''
  const start = partialTok?.start ?? line.length
  const before = (atNewToken ? tokens : tokens.slice(0, -1)).map((t) => t.value)
  const result = (candidates: Candidate[]): Completion => ({ start, partial, candidates })
  const byPrefix = (cs: Candidate[]) => cs.filter((c) => c.value.startsWith(partial))

  if (before.length === 0) return result(byPrefix([{ value: spec.cli, description: spec.description }]))
  if (before[0] !== spec.cli) return result([])

  const s = walk(spec, before.slice(1))
  if (s.afterDoubleDash) return result([])

  if (s.pendingFlag) return result(byPrefix((s.pendingFlag.values ?? []).map((v) => ({ value: v }))))

  if (partial.startsWith('-')) {
    const dash = s.dash
    const flags = availableFlags(spec, s.node)
    const eq = partial.indexOf('=')
    if (partial.startsWith(dash) && eq !== -1) {
      const flag = flags.find((f) => f.name === partial.slice(dash.length, eq))
      return result(byPrefix((flag?.values ?? []).map((v) => ({ value: `${dash}${flag!.name}=${v}` }))))
    }
    const unused = flags.filter((f) => !(f.name in s.flags))
    const cs: Candidate[] = unused.map((f) => ({
      value: `${dash}${f.name}`,
      description: `${f.short ? `-${f.short}, ` : ''}${f.description}`,
    }))
    if (dash === '--' && !partial.startsWith('--'))
      for (const f of unused) if (f.short) cs.push({ value: `-${f.short}`, description: `--${f.name}: ${f.description}` })
    return result(byPrefix(cs))
  }

  if (expectsSubcommand(s.node, s.positionals))
    return result(byPrefix(s.node.subcommands!.map((c) => ({ value: c.name, description: c.description }))))

  const arg = s.node.args?.[s.positionals.length]
  const set = arg?.valueSet ? spec.valueSets[arg.valueSet] : undefined
  if (!set) return result([])
  return result(
    set
      .filter((v) => [v.value, ...(v.aliases ?? [])].some((x) => x.startsWith(partial)))
      .map((v) => ({ value: v.value, description: v.aliases?.length ? `${v.description} (${v.aliases.join(', ')})` : v.description })),
  )
}

export function commonPrefix(values: string[]): string {
  if (values.length === 0) return ''
  let prefix = values[0]
  for (const v of values) while (!v.startsWith(prefix)) prefix = prefix.slice(0, -1)
  return prefix
}

/** Aplica un Tab: completa si hay un único candidato o un prefijo común más largo. */
export function applyCompletion(line: string, c: Completion): { line: string; changed: boolean } {
  const values = c.candidates.map((x) => x.value)
  if (values.length === 1) {
    const v = values[0]
    return { line: line.slice(0, c.start) + v + ' ', changed: true }
  }
  const prefix = commonPrefix(values)
  if (prefix.length > c.partial.length) return { line: line.slice(0, c.start) + prefix, changed: true }
  return { line, changed: false }
}

/** Sustituye el token en curso por un candidato concreto (elegido en la lista). */
export function acceptCandidate(line: string, c: Completion, value: string): string {
  return line.slice(0, c.start) + value + ' '
}
