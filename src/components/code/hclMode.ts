import type { StreamParser } from '@codemirror/language'

// Resaltado sencillo de HCL/Terraform para CodeMirror (no hay modo oficial).
// Solo colorea; la validación real la hace tree-sitter en src/engine/hcl.ts.

interface State {
  inBlockComment: boolean
  inString: boolean
  /** Profundidad de ${ } dentro de un string. */
  interp: number
}

export const hclStream: StreamParser<State> = {
  name: 'hcl',
  startState: () => ({ inBlockComment: false, inString: false, interp: 0 }),
  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.skipTo('*/')) {
        stream.next()
        stream.next()
        state.inBlockComment = false
      } else stream.skipToEnd()
      return 'comment'
    }
    if (state.inString && state.interp === 0) {
      while (!stream.eol()) {
        if (stream.match('${', false)) break
        const ch = stream.next()
        if (ch === '\\') stream.next()
        else if (ch === '"') {
          state.inString = false
          return 'string'
        }
      }
      if (stream.match('${')) {
        state.interp = 1
        return 'meta'
      }
      return 'string'
    }
    if (stream.eatSpace()) return null
    if (state.interp > 0) {
      if (stream.eat('{')) state.interp++
      else if (stream.eat('}')) {
        state.interp--
        return state.interp === 0 ? 'meta' : 'punctuation'
      }
    }
    if (stream.match('#') || stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('/*')) {
      state.inBlockComment = true
      return 'comment'
    }
    if (stream.eat('"')) {
      state.inString = true
      return 'string'
    }
    if (stream.match(/^-?\d+(\.\d+)?/)) return 'number'
    if (stream.match(/^(true|false|null)\b/)) return 'bool'
    if (stream.match(/^[A-Za-z_][\w-]*/)) {
      const word = stream.current()
      // Nombre de atributo: lo sigue un "=" (pero no "==").
      if (stream.match(/^\s*=(?!=)/, false)) return 'propertyName'
      // Tipo de bloque al inicio de línea: resource, variable, provider...
      if (stream.column() === stream.indentation() && stream.match(/^\s*("|\{|[A-Za-z_])/, false)) return 'keyword'
      if (['var', 'local', 'module', 'data', 'each', 'count', 'path', 'self'].includes(word)) return 'variableName'
      return null
    }
    stream.next()
    return 'punctuation'
  },
  languageData: { commentTokens: { line: '#', block: { open: '/*', close: '*/' } } },
}
