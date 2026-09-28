import type { GlossaryEntry } from './schema'

// Plugin de remark: marca la PRIMERA aparición de cada término del glosario en
// una lección como <span class="glossary-term" data-term="...">. MarkdownView
// convierte esos span en tooltips. No toca títulos, código ni enlaces.

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: Record<string, unknown>
}

const SKIP = new Set(['heading', 'code', 'inlineCode', 'link', 'linkReference', 'glossary'])

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Expresión que encuentra los términos: admite plural simple ("Pods"), respeta
 * los límites de palabra en Unicode y no marca nombres con punto ("Node.js").
 * Los términos deben ir de más largo a más corto.
 */
export function glossaryPattern(terms: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map(escapeRegExp).join('|')})(s|es)?(?![\\p{L}\\p{N}]|\\.\\p{L})`, 'gu')
}

/** Términos del glosario que se marcan en una lección del itinerario dado. */
export function glossaryForTrack(entries: GlossaryEntry[], trackId: string): GlossaryEntry[] {
  return entries.filter((e) => !e.trackOnly || e.introducedIn.startsWith(`${trackId}/`))
}

export function remarkGlossary(entries: GlossaryEntry[]) {
  return () => (tree: MdNode) => {
    const pending = new Set(entries.map((e) => e.term))
    // Términos largos primero para que "Pod" no gane a "PodSpec", por ejemplo.
    const terms = [...pending].sort((a, b) => b.length - a.length)
    if (terms.length === 0) return
    const re = glossaryPattern(terms)

    const walk = (node: MdNode) => {
      if (!node.children || SKIP.has(node.type)) return
      const out: MdNode[] = []
      for (const child of node.children) {
        if (child.type !== 'text' || pending.size === 0) {
          walk(child)
          out.push(child)
          continue
        }
        const text = child.value ?? ''
        let last = 0
        for (const m of text.matchAll(re)) {
          const term = m[1]
          if (!pending.has(term)) continue
          pending.delete(term)
          if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
          out.push({
            type: 'glossary',
            data: { hName: 'span', hProperties: { className: ['glossary-term'], dataTerm: term } },
            children: [{ type: 'text', value: m[0] }],
          })
          last = m.index + m[0].length
        }
        if (last === 0) out.push(child)
        else if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
      }
      node.children = out
    }
    walk(tree)
  }
}
