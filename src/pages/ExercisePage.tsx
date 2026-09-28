import { use, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ExerciseInput } from '../components/exercises/ExerciseInput'
import { HintPanel } from '../components/exercises/HintPanel'
import { LoadBoundary } from '../components/LoadBoundary'
import { LockedNotice } from '../components/LockedNotice'
import { loadExercises, type Module } from '../content/loader'
import { MarkdownView } from '../components/MarkdownView'
import type { Exercise } from '../content/schema'
import { emptyAnswer, isAnswered, isSupported, type GradeResult } from '../engine/grade'
import { gradeExercise } from '../lib/gradeExercise'
import { exerciseKey } from '../engine/progress'
import { useProgress } from '../store/progressStore'
import { Placeholder } from './Placeholder'
import { useModuleAccess } from './useModuleAccess'

export function ExercisePage() {
  const { exerciseId = '' } = useParams()
  const { mod, locked, reasons } = useModuleAccess()
  const index = mod?.exercises.findIndex((e) => e.id === exerciseId) ?? -1
  if (!mod || index === -1) return <Placeholder title="Ejercicio no encontrado" phase="ninguna" />
  const base = `/modulo/${mod.trackId}/${mod.slug}`

  return (
    <section className="max-w-3xl">
      <Link to={base} className="text-sm text-slate-400 hover:text-slate-200">
        ← {mod.title}
      </Link>
      <p className="mt-2 text-sm text-slate-500">
        Ejercicio {index + 1} de {mod.exercises.length}
      </p>
      {locked ? (
        <div className="mt-4">
          <LockedNotice reasons={reasons} />
        </div>
      ) : (
        <LoadBoundary what="el ejercicio">
          <LoadedPractice
            mod={mod}
            exerciseId={exerciseId}
            next={mod.exercises[index + 1] ? `${base}/ejercicio/${mod.exercises[index + 1].id}` : undefined}
            back={base}
          />
        </LoadBoundary>
      )}
    </section>
  )
}

// Los ejercicios del módulo se descargan al entrar al primero (loadExercises cachea la promesa).
function LoadedPractice({ mod, exerciseId, next, back }: { mod: Module; exerciseId: string; next?: string; back: string }) {
  const ex = use(loadExercises(mod)).find((e) => e.id === exerciseId)
  if (!ex) return <Placeholder title="Ejercicio no encontrado" phase="ninguna" />
  // key: al cambiar de ejercicio se reinicia todo el estado local.
  return <Practice key={ex.id} ex={ex} moduleRef={mod.ref} next={next} back={back} />
}

function Practice({ ex, moduleRef, next, back }: { ex: Exercise; moduleRef: string; next?: string; back: string }) {
  const key = exerciseKey(moduleRef, ex.id)
  const { attempt, hintUsed } = useProgress()
  const solvedBefore = useProgress((s) => s.exercises[key]?.solved ?? false)
  const [answer, setAnswer] = useState(() => emptyAnswer(ex))
  const [result, setResult] = useState<GradeResult>()
  const [hints, setHints] = useState(0)
  const [failedOnce, setFailedOnce] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [grading, setGrading] = useState(false)
  const [gradeError, setGradeError] = useState<string>()
  const supported = isSupported(ex)

  const check = async () => {
    if (!isAnswered(answer) || result || grading) return
    setGrading(true)
    setGradeError(undefined)
    let r: GradeResult
    try {
      r = await gradeExercise(ex, answer)
    } catch {
      setGradeError('No se pudo cargar el corrector. Revisa tu conexión y vuelve a intentarlo.')
      return
    } finally {
      setGrading(false)
    }
    setResult(r)
    attempt(key, r.correct)
    if (!r.correct) setFailedOnce(true)
    else setShowSolution(true)
  }

  const retry = () => {
    setResult(undefined)
    setShowSolution(false)
  }

  return (
    <div className="mt-2 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-lg [&_p]:my-1">
          <MarkdownView source={ex.prompt} />
        </div>
        {solvedBefore && <span className="shrink-0 rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">✓ Resuelto</span>}
      </div>

      <ExerciseInput ex={ex} answer={answer} onChange={setAnswer} result={result} onSubmit={check} />

      {supported && (
        <div className="flex flex-wrap gap-3">
          {!result && (
            <button
              type="button"
              onClick={check}
              disabled={!isAnswered(answer) || grading}
              className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {grading ? 'Comprobando…' : 'Comprobar'}
            </button>
          )}
          {result && !result.correct && (
            <button type="button" onClick={retry} className="rounded-md border border-slate-600 px-4 py-2 hover:bg-slate-800">
              Intentar de nuevo
            </button>
          )}
          {failedOnce && !showSolution && (
            <button
              type="button"
              onClick={() => setShowSolution(true)}
              className="rounded-md border border-slate-600 px-4 py-2 hover:bg-slate-800"
            >
              Ver solución explicada
            </button>
          )}
          {result?.correct && (
            <Link to={next ?? back} className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500">
              {next ? 'Siguiente ejercicio →' : 'Volver al módulo'}
            </Link>
          )}
        </div>
      )}

      {gradeError && <p className="text-sm text-red-300">{gradeError}</p>}

      {result && (
        <p className={`font-medium ${result.correct ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.correct ? '¡Correcto!' : 'No es correcto todavía. Revisa lo marcado en rojo, usa una pista o vuelve a intentarlo.'}
        </p>
      )}

      {showSolution && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-300">Solución explicada</p>
          {ex.solution.answer && (
            <pre className="mt-2 overflow-x-auto rounded bg-slate-900 px-3 py-2 font-mono text-sm">{ex.solution.answer}</pre>
          )}
          <div className="text-sm [&_p]:my-2">
            <MarkdownView source={ex.solution.explanation} />
          </div>
        </div>
      )}

      {supported && !result?.correct && (
        <HintPanel
          hints={ex.hints}
          revealed={hints}
          onReveal={() => {
            setHints((h) => h + 1)
            hintUsed(key)
          }}
        />
      )}
    </div>
  )
}
