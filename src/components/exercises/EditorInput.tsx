import { lazy, Suspense } from 'react'
import type { EditorExercise } from '../../content/schema'
import type { GradeResult } from '../../engine/grade'

const CodeEditor = lazy(() => import('../code/CodeEditor'))

interface Props {
  ex: EditorExercise
  code: string
  onChange: (code: string) => void
  result?: GradeResult
}

export function EditorInput({ ex, code, onChange, result }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{ex.language === 'hcl' ? 'Terraform (HCL)' : 'YAML'} · Tab inserta 2 espacios</span>
        {!result && code !== ex.starter && (
          <button type="button" onClick={() => onChange(ex.starter)} className="hover:text-slate-300">
            ↺ Volver al código inicial
          </button>
        )}
      </div>
      <Suspense
        fallback={
          <pre className="min-h-40 rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-400">{code}</pre>
        }
      >
        <CodeEditor language={ex.language} value={code} onChange={onChange} readOnly={!!result} ariaLabel={`Editor ${ex.language.toUpperCase()}`} />
      </Suspense>

      {result?.feedback && (
        <p className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">{result.feedback}</p>
      )}
      {result?.checks && result.checks.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm">
          {result.checks.map((c, i) => (
            <li key={i} className={`flex gap-2 ${c.ok ? 'text-emerald-300' : 'text-red-300'}`}>
              <span aria-hidden>{c.ok ? '✓' : '✗'}</span>
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
