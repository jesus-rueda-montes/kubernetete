import type { QuizExercise } from '../../content/schema'
import type { GradeResult } from '../../engine/grade'
import { MarkdownView } from '../MarkdownView'

interface Props {
  ex: QuizExercise
  selected: string[]
  onChange: (selected: string[]) => void
  /** Si hay resultado, se muestran aciertos y la explicación de cada opción. */
  result?: GradeResult
}

export function QuizInput({ ex, selected, onChange, result }: Props) {
  const multi = ex.mode === 'multi'
  const toggle = (id: string) => {
    if (result) return
    if (!multi) return onChange([id])
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm text-slate-400">
        {multi ? 'Marca todas las correctas.' : 'Elige una respuesta.'}
      </legend>
      {ex.options.map((o) => {
        const checked = selected.includes(o.id)
        let tone = checked ? 'border-sky-600 bg-sky-950/40' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
        if (result) {
          if (o.correct) tone = 'border-emerald-600 bg-emerald-950/40'
          else if (checked) tone = 'border-red-600 bg-red-950/40'
          else tone = 'border-slate-800 bg-slate-900/30 opacity-70'
        }
        return (
          <label key={o.id} className={`block cursor-pointer rounded-lg border px-4 py-3 transition ${tone}`}>
            <span className="flex items-start gap-3">
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={ex.id}
                className="mt-1.5 accent-sky-500"
                checked={checked}
                disabled={!!result}
                onChange={() => toggle(o.id)}
              />
              <span className="min-w-0 flex-1 [&_p]:my-0">
                <MarkdownView source={o.text} />
                {result && (checked || o.correct) && (
                  <span className={`mt-1 block text-sm ${o.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                    {o.explanation}
                  </span>
                )}
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
