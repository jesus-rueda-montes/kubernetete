import { useMemo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkGlossary } from '../content/glossaryPlugin'
import type { GlossaryEntry } from '../content/schema'
import { CodeBlock } from './code/CodeBlock'
import { GlossaryTerm } from './GlossaryTerm'

// Estilos por elemento en lugar de un plugin de "prose": así controlamos
// exactamente cómo se ve cada parte de una lección.
const components: Components = {
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 border-b border-slate-800 pb-1 text-xl font-semibold text-sky-300">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 leading-7 text-slate-200">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 text-slate-200">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 pl-6 text-slate-200">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="text-sky-400 underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  // Los bloques (```lenguaje) los pinta CodeBlock con resaltado; aquí el <pre>
  // solo deja pasar a su hijo para no anidar dos <pre>.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const language = /language-([\w-]+)/.exec(className ?? '')?.[1]
    const text = String(children)
    if (language || text.includes('\n')) return <CodeBlock code={text.replace(/\n$/, '')} language={language ?? ''} />
    return <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-amber-200">{children}</code>
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-slate-700 bg-slate-900 px-3 py-2 text-left">{children}</th>,
  td: ({ children }) => <td className="border border-slate-800 px-3 py-2 align-top">{children}</td>,
}

export function MarkdownView({ source, glossary }: { source: string; glossary?: GlossaryEntry[] }) {
  const plugins = useMemo(() => (glossary ? [remarkGfm, remarkGlossary(glossary)] : [remarkGfm]), [glossary])
  const allComponents = useMemo<Components>(() => {
    if (!glossary) return components
    const definitions = new Map(glossary.map((g) => [g.term, g.definition]))
    return {
      ...components,
      span: ({ className, children, ...rest }) => {
        const term = (rest as Record<string, unknown>)['data-term']
        const definition = typeof term === 'string' ? definitions.get(term) : undefined
        if (className === 'glossary-term' && definition)
          return <GlossaryTerm definition={definition}>{children}</GlossaryTerm>
        return <span className={className}>{children}</span>
      },
    }
  }, [glossary])

  return (
    <Markdown remarkPlugins={plugins} components={allComponents}>
      {source}
    </Markdown>
  )
}
