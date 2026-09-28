import { describe, expect, test } from 'vitest'
import { check, gradeYaml, parsePath, parseYaml, resolve, type Assertion } from './yamlAssert'

const pod = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { name: 'web', labels: { app: 'web' } },
  spec: {
    containers: [
      { name: 'nginx', image: 'nginx:1.27', ports: [{ containerPort: 80 }] },
      { name: 'logs', image: 'busybox:1.36' },
    ],
  },
}

describe('parsePath', () => {
  test('claves, índices, comodín y filtros', () => {
    expect(parsePath('spec.containers[0].image')).toEqual([
      { kind: 'key', key: 'spec' },
      { kind: 'key', key: 'containers' },
      { kind: 'index', index: 0 },
      { kind: 'key', key: 'image' },
    ])
    expect(parsePath('a[*].b[name=web]')).toEqual([
      { kind: 'key', key: 'a' },
      { kind: 'all' },
      { kind: 'key', key: 'b' },
      { kind: 'filter', key: 'name', value: 'web' },
    ])
  })

  test('claves entre comillas con puntos y barras', () => {
    expect(parsePath("metadata.annotations['equipo.example.com/contacto']")).toEqual([
      { kind: 'key', key: 'metadata' },
      { kind: 'key', key: 'annotations' },
      { kind: 'key', key: 'equipo.example.com/contacto' },
    ])
    const doc = { metadata: { labels: { 'app.kubernetes.io/name': 'web' } } }
    expect(resolve(doc, 'metadata.labels["app.kubernetes.io/name"]')).toEqual(['web'])
  })

  test('rechaza rutas mal formadas', () => {
    for (const bad of ['', 'a..b', '.a', 'a.', 'a[x y]', 'a[0]b']) expect(() => parsePath(bad)).toThrow(/ruta inválida/)
  })
})

describe('resolve y check', () => {
  test('resolve', () => {
    expect(resolve(pod, 'metadata.name')).toEqual(['web'])
    expect(resolve(pod, 'spec.containers[*].name')).toEqual(['nginx', 'logs'])
    expect(resolve(pod, 'spec.containers[name=logs].image')).toEqual(['busybox:1.36'])
    expect(resolve(pod, 'spec.containers[5].image')).toEqual([])
    expect(resolve(pod, 'metadata.nope.deeper')).toEqual([])
  })

  const ok = (a: Omit<Assertion, 'message'>) => check(pod, { ...a, message: 'm' })

  test('operadores', () => {
    expect(ok({ path: 'kind', op: 'equals', value: 'Pod' })).toBe(true)
    expect(ok({ path: 'kind', op: 'equals', value: 'pod' })).toBe(false)
    expect(ok({ path: 'spec.containers[0].ports[0].containerPort', op: 'equals', value: 80 })).toBe(true)
    expect(ok({ path: 'spec.containers[0].ports[0].containerPort', op: 'equals', value: '80' })).toBe(false)
    expect(ok({ path: 'metadata.labels', op: 'equals', value: { app: 'web' } })).toBe(true)
    expect(ok({ path: 'metadata.labels.app', op: 'exists' })).toBe(true)
    expect(ok({ path: 'metadata.namespace', op: 'exists' })).toBe(false)
    expect(ok({ path: 'metadata.namespace', op: 'absent' })).toBe(true)
    expect(ok({ path: 'spec.containers[*].image', op: 'matches', value: ':[0-9]' })).toBe(true)
    expect(ok({ path: 'spec.containers[*].image', op: 'matches', value: 'nginx' })).toBe(false)
    expect(ok({ path: 'kind', op: 'oneOf', value: ['Pod', 'Deployment'] })).toBe(true)
    expect(ok({ path: 'spec.containers', op: 'count', value: 2 })).toBe(true)
    expect(check({ g: { web: null, db: null } }, { path: 'g', op: 'hasKeys', value: ['web', 'db'], message: '' })).toBe(true)
    expect(check({ g: { web: null } }, { path: 'g', op: 'hasKeys', value: ['web', 'db'], message: '' })).toBe(false)
    expect(check({ g: ['web', 'db'] }, { path: 'g', op: 'hasKeys', value: ['web'], message: '' })).toBe(false)
    expect(ok({ path: 'spec.containers[*].ports', op: 'count', value: 1 })).toBe(true)
  })

  test('sin valores, equals/matches/oneOf fallan (no pasan "en vacío")', () => {
    expect(ok({ path: 'nope', op: 'equals', value: 'x' })).toBe(false)
    expect(ok({ path: 'nope', op: 'matches', value: '.*' })).toBe(false)
    expect(ok({ path: 'nope', op: 'oneOf', value: ['x'] })).toBe(false)
  })
})

describe('parseYaml y gradeYaml', () => {
  test('errores de sintaxis con número de línea y aviso de tabuladores', () => {
    const r = parseYaml('kind: Pod\nmetadata:\n\tname: web\n')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/línea 3/)
      expect(r.error).toMatch(/tabuladores/)
    }
    expect(parseYaml('')).toEqual({ ok: false, error: 'El documento está vacío.' })
    expect(parseYaml('a: 1\n---\nb: 2').ok).toBe(false)
  })

  test('los errores frecuentes se explican en español', () => {
    const err = (s: string) => {
      const r = parseYaml(s)
      return r.ok ? '' : r.error
    }
    expect(err('a: 1\n  b: 2')).toMatch(/línea 2: la indentación no cuadra/)
    expect(err('a: 1\na: 2')).toMatch(/clave repetida/)
    expect(err('a: [1, 2')).toMatch(/falta cerrar/)
    expect(err('{a: 1 b: 2}')).toMatch(/falta una coma/)
  })

  test('devuelve cada comprobación con su mensaje', () => {
    const r = gradeYaml('kind: Pod\nmetadata:\n  name: api\n', [
      { path: 'kind', op: 'equals', value: 'Pod', message: 'kind debe ser Pod' },
      { path: 'metadata.name', op: 'equals', value: 'web', message: 'el nombre debe ser web' },
    ])
    expect(r).toEqual({
      correct: false,
      checks: [
        { message: 'kind debe ser Pod', ok: true },
        { message: 'el nombre debe ser web', ok: false },
      ],
    })
  })
})
