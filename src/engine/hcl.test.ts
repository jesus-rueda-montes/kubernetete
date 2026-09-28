// @vitest-environment node
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, test } from 'vitest'
import { buildCatalog } from '../content/loader'
import { loadRawContent } from '../content/rawContent'
import { createHclParser, gradeHcl, type HclParser } from './hcl'

// En tests se carga la gramática desde disco; en el navegador, por URL (hclLoader.ts).
let hcl: HclParser
beforeAll(async () => {
  hcl = await createHclParser({ grammar: readFileSync('src/vendor/tree-sitter-hcl/tree-sitter-terraform.wasm') })
})

const sample = `
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# Región por defecto
variable "region" {
  type    = string
  default = "europe-west1"
}

resource "google_storage_bucket" "logs" {
  name          = "mi-bucket-logs"
  location      = var.region
  force_destroy = true
  labels = {
    env = "dev"
  }
  versioning {
    enabled = true
  }
}

output "url" {
  value = "gs://\${google_storage_bucket.logs.name}"
}
`

describe('conversión a estructura', () => {
  test('bloques con etiquetas, atributos, mapas y bloques anidados', () => {
    const r = hcl.parse(sample)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.doc).toEqual({
      terraform: [{ required_providers: [{ google: { source: 'hashicorp/google', version: '~> 6.0' } }] }],
      variable: { region: [{ type: 'string', default: 'europe-west1' }] },
      resource: {
        google_storage_bucket: {
          logs: [
            {
              name: 'mi-bucket-logs',
              location: 'var.region',
              force_destroy: true,
              labels: { env: 'dev' },
              versioning: [{ enabled: true }],
            },
          ],
        },
      },
      output: { url: [{ value: 'gs://${google_storage_bucket.logs.name}' }] },
    })
  })

  test('números, listas, null y bloques repetidos', () => {
    const r = hcl.parse('a = 3\nb = [1, "x", null]\nrule { p = 80 }\nrule { p = 443 }\n')
    expect(r).toEqual({ ok: true, doc: { a: 3, b: [1, 'x', null], rule: [{ p: 80 }, { p: 443 }] } })
  })
})

describe('errores', () => {
  const error = (src: string) => {
    const r = hcl.parse(src)
    return r.ok ? '' : r.error
  }

  test('llaves, corchetes y comillas sin cerrar', () => {
    expect(error('resource "a" "b" {\n  name = "x"\n')).toMatch(/línea 3.*falta "}" para cerrar/)
    expect(error('resource "a" {\n  tags = ["a", "b"\n}\n')).toMatch(/falta "]" para cerrar la lista/)
    expect(error('resource "a" "b" {\n  name = "x\n}\n')).toMatch(/faltan las comillas de cierre/)
  })

  test('cabecera de bloque sin "{"', () => {
    expect(error('resource "a" "b"\n  name = "x"\n}\n')).toMatch(/¿Falta "\{" al final de «resource "a" "b"»\?/)
  })

  test('":" en lugar de "=" (hábito de YAML)', () => {
    expect(error('resource "a" "b" {\n  name: "x"\n}\n')).toMatch(/línea 2.*se asignan con "="/)
  })

  test('valor ausente', () => {
    expect(error('resource "a" "b" {\n  name =\n}\n')).toMatch(/Error de sintaxis HCL/)
  })

  test('atributo repetido y archivo vacío', () => {
    expect(error('a = 1\na = 2\n')).toMatch(/Atributo repetido en la línea 2: "a"/)
    expect(error('# solo un comentario\n')).toBe('El archivo está vacío.')
  })
})

// El loader (síncrono) valida las soluciones YAML; las HCL necesitan el parser
// wasm (asíncrono), así que se validan aquí.
test('contenido: la solución de cada ejercicio HCL pasa sus comprobaciones', () => {
  const { modules } = buildCatalog(loadRawContent())
  const hclExercises = modules.flatMap((m) =>
    (m.fullExercises ?? []).filter((e) => e.type === 'editor' && e.language === 'hcl').map((e) => ({ ref: m.ref, e })),
  )
  expect(hclExercises.length).toBeGreaterThan(0)
  for (const { ref, e } of hclExercises) {
    if (e.type !== 'editor') continue
    const r = gradeHcl(hcl, e.solution.answer ?? '', e.assertions)
    const failed = r.feedback ?? r.checks.filter((c) => !c.ok).map((c) => c.message).join('; ')
    expect(r.correct, `${ref} [${e.id}]: ${failed}`).toBe(true)
    // Y el código inicial NO debe aprobar ya de por sí.
    expect(gradeHcl(hcl, e.starter, e.assertions).correct, `${ref} [${e.id}]: el starter ya aprueba`).toBe(false)
  }
})

test('gradeHcl reutiliza las aserciones de ruta', () => {
  const r = gradeHcl(hcl, sample, [
    { path: 'resource.google_storage_bucket.logs[0].location', op: 'equals', value: 'var.region', message: 'usa la variable' },
    { path: 'resource.google_storage_bucket.logs[0].versioning[0].enabled', op: 'equals', value: true, message: 'versionado' },
    { path: 'resource.google_storage_bucket.logs[0].labels.env', op: 'equals', value: 'prod', message: 'etiqueta env=prod' },
  ])
  expect(r.checks.map((c) => c.ok)).toEqual([true, true, false])
  expect(r.correct).toBe(false)
})
