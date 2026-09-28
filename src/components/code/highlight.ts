import { jsonLanguage } from '@codemirror/lang-json'
import { yamlLanguage } from '@codemirror/lang-yaml'
import { StreamLanguage } from '@codemirror/language'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import type { Parser } from '@lezer/common'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import { hclStream } from './hclMode'

// Resaltado estático (sin editor) para los bloques de código de las lecciones.
// Usa los mismos parsers y clases "tok-*" que el editor, así se ven igual.

const shellParser = StreamLanguage.define(shell).parser
const hclParser = StreamLanguage.define(hclStream).parser
const dockerfileParser = StreamLanguage.define(dockerFile).parser
const iniParser = StreamLanguage.define(properties).parser

const PARSERS: Record<string, Parser> = {
  yaml: yamlLanguage.parser,
  yml: yamlLanguage.parser,
  json: jsonLanguage.parser,
  bash: shellParser,
  sh: shellParser,
  shell: shellParser,
  hcl: hclParser,
  terraform: hclParser,
  tf: hclParser,
  dockerfile: dockerfileParser,
  ini: iniParser,
}

export interface Span {
  text: string
  className: string
}

/** Devuelve líneas de fragmentos con clase; null si el lenguaje no está soportado. */
export function highlight(code: string, language: string): Span[][] | null {
  const parser = PARSERS[language]
  if (!parser) return null
  const lines: Span[][] = [[]]
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, className) => lines[lines.length - 1].push({ text, className }),
    () => lines.push([]),
  )
  return lines
}
