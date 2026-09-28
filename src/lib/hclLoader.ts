import runtimeUrl from 'web-tree-sitter/web-tree-sitter.wasm?url'
import grammarUrl from '../vendor/tree-sitter-hcl/tree-sitter-terraform.wasm?url'
import { createHclParser, type HclParser } from '../engine/hcl'

// Carga perezosa del parser HCL en el navegador (~300 KB de wasm): solo se
// descarga la primera vez que se corrige un ejercicio de Terraform.
let pending: Promise<HclParser> | null = null

export function getHclParser(): Promise<HclParser> {
  pending ??= createHclParser({ runtime: runtimeUrl, grammar: grammarUrl }).catch((e: unknown) => {
    pending = null // permitir reintentar si falló la descarga
    throw e
  })
  return pending
}
