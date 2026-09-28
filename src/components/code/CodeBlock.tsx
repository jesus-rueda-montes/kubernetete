import { highlight } from './highlight'

/** Bloque de código de una lección, con resaltado si el lenguaje está soportado. */
export function CodeBlock({ code, language }: { code: string; language: string }) {
  const lines = highlight(code, language)
  return (
    <pre className="my-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm leading-6">
      <code className="font-mono text-slate-100">
        {lines
          ? lines.map((spans, i) => (
              <span key={i}>
                {spans.map((s, j) =>
                  s.className ? (
                    <span key={j} className={s.className}>
                      {s.text}
                    </span>
                  ) : (
                    s.text
                  ),
                )}
                {i < lines.length - 1 && '\n'}
              </span>
            ))
          : code}
      </code>
    </pre>
  )
}
