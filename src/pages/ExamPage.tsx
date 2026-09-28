import { use, useState } from 'react'
import { Link } from 'react-router'
import { ExerciseInput } from '../components/exercises/ExerciseInput'
import { LoadBoundary } from '../components/LoadBoundary'
import { LockedNotice } from '../components/LockedNotice'
import { MarkdownView } from '../components/MarkdownView'
import { getCatalog, loadExercises, type Module } from '../content/loader'
import type { Exercise } from '../content/schema'
import { buildExam, examScore, examSize } from '../engine/exam'
import { emptyAnswer, isAnswered, type Answer, type GradeResult } from '../engine/grade'
import { gradeAll } from '../lib/gradeExercise'
import { PASS_SCORE } from '../engine/progress'
import { useProgress } from '../store/progressStore'
import { Placeholder } from './Placeholder'
import { useModuleAccess } from './useModuleAccess'

const pct = (n: number) => `${Math.round(n * 100)}%`

export function ExamPage() {
  const { mod, locked, reasons } = useModuleAccess()
  if (!mod) return <Placeholder title="Módulo no encontrado" phase="ninguna" />
  const base = `/modulo/${mod.trackId}/${mod.slug}`
  return (
    <section className="max-w-3xl">
      <Link to={base} className="text-sm text-slate-400 hover:text-slate-200">
        ← {mod.title}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Examen: {mod.title}</h1>
      <div className="mt-4">
        {locked ? (
          <LockedNotice reasons={reasons} />
        ) : (
          <LoadBoundary what="el examen">
            <Exam mod={mod} base={base} />
          </LoadBoundary>
        )}
      </div>
    </section>
  )
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'running'; questions: Exercise[]; answers: Answer[]; current: number }
  | { kind: 'done'; questions: Exercise[]; answers: Answer[]; results: GradeResult[]; score: number }

function Exam({ mod, base }: { mod: Module; base: string }) {
  const recordExam = useProgress((s) => s.exam)
  const previous = useProgress((s) => s.exams[mod.ref])
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  // Los ejercicios del módulo se descargan al abrir el examen (loadExercises cachea la promesa).
  const exercises = use(loadExercises(mod))

  if (phase.kind === 'intro') {
    const count = examSize(mod)
    return (
      <div className="space-y-4">
        <ul className="list-disc space-y-1 pl-6 text-slate-300">
          <li>{count} preguntas de todo el módulo, en orden aleatorio.</li>
          <li>Necesitas un <strong>{pct(PASS_SCORE)}</strong> para aprobar y desbloquear el siguiente módulo.</li>
          <li>En el examen <strong>no hay pistas</strong>. Verás las correcciones y explicaciones al entregar.</li>
          <li>Puedes repetirlo las veces que quieras; se guarda tu mejor nota.</li>
        </ul>
        {previous && (
          <p className="text-sm text-slate-400">
            Mejor nota: {pct(previous.best)} {previous.passed ? '· ✓ Aprobado' : ''} · {previous.attempts} intento(s)
          </p>
        )}
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            const questions = buildExam(exercises)
            setPhase({ kind: 'running', questions, answers: questions.map(emptyAnswer), current: 0 })
          }}
          className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          Empezar examen
        </button>
      </div>
    )
  }

  if (phase.kind === 'running') {
    const { questions, answers, current } = phase
    const ex = questions[current]
    const isLast = current === questions.length - 1
    const pending = answers.filter((a) => !isAnswered(a)).length
    const go = (to: number) => setPhase({ ...phase, current: to })
    const submit = async () => {
      setSubmitting(true)
      setSubmitError(undefined)
      let results: GradeResult[]
      try {
        results = await gradeAll(questions.map((q, i) => ({ ex: q, answer: answers[i] })))
      } catch {
        setSubmitError('No se pudo cargar el corrector. Revisa tu conexión y vuelve a entregar.')
        return
      } finally {
        setSubmitting(false)
      }
      const score = examScore(results.map((r) => r.correct))
      recordExam(mod, score)
      setPhase({ kind: 'done', questions, answers, results, score })
    }

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              aria-label={`Pregunta ${i + 1}`}
              onClick={() => go(i)}
              className={`h-2.5 flex-1 rounded-full ${i === current ? 'bg-sky-400' : isAnswered(answers[i]) ? 'bg-sky-800' : 'bg-slate-800'}`}
            />
          ))}
        </div>
        <p className="text-sm text-slate-500">
          Pregunta {current + 1} de {questions.length}
        </p>
        {/* data-exercise-id: lo usa el test e2e para saber qué pregunta es. */}
        <div className="text-lg [&_p]:my-1" data-exercise-id={ex.id}>
          <MarkdownView source={ex.prompt} />
        </div>
        <ExerciseInput
          key={ex.id}
          ex={ex}
          answer={answers[current]}
          onChange={(a) => setPhase({ ...phase, answers: answers.map((old, i) => (i === current ? a : old)) })}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => go(current - 1)}
            className="rounded-md border border-slate-600 px-4 py-2 hover:bg-slate-800 disabled:opacity-40"
          >
            ← Anterior
          </button>
          {!isLast ? (
            <button type="button" onClick={() => go(current + 1)} className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500">
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? 'Corrigiendo…' : 'Entregar examen'}
            </button>
          )}
          {isLast && pending > 0 && <span className="text-sm text-amber-300">Quedan {pending} sin responder (contarán como fallo).</span>}
          {submitError && <span className="text-sm text-red-300">{submitError}</span>}
        </div>
      </div>
    )
  }

  const passed = phase.score >= PASS_SCORE
  const sameTrack = getCatalog().modules.filter((m) => m.trackId === mod.trackId)
  const nextModule = sameTrack[sameTrack.findIndex((m) => m.ref === mod.ref) + 1]
  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-5 ${passed ? 'border-emerald-700 bg-emerald-950/30' : 'border-amber-700 bg-amber-950/20'}`}>
        <p className="text-3xl font-bold">{pct(phase.score)}</p>
        <p className="mt-1">
          {!passed
            ? `Te falta poco: necesitas un ${pct(PASS_SCORE)}. Repasa las explicaciones de abajo y vuelve a intentarlo.`
            : nextModule
              ? `¡Aprobado! Has desbloqueado «${nextModule.title}».`
              : '¡Aprobado! Has completado todos los módulos disponibles de este itinerario.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={base} className="rounded-md border border-slate-600 px-4 py-2 hover:bg-slate-800">
            Volver al módulo
          </Link>
          {passed && nextModule && (
            <Link
              to={`/modulo/${nextModule.trackId}/${nextModule.slug}`}
              className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
            >
              Ir a «{nextModule.title}» →
            </Link>
          )}
          {!passed && (
            <button type="button" onClick={() => setPhase({ kind: 'intro' })} className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500">
              Repetir examen
            </button>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold">Corrección</h2>
      <ol className="space-y-6">
        {phase.questions.map((q, i) => (
          <li key={q.id} className="space-y-3 border-t border-slate-800 pt-4">
            <p className={`text-sm font-medium ${phase.results[i].correct ? 'text-emerald-400' : 'text-red-400'}`}>
              {i + 1}. {phase.results[i].correct ? '✓ Correcta' : '✗ Incorrecta'}
            </p>
            <div className="[&_p]:my-1">
              <MarkdownView source={q.prompt} />
            </div>
            <ExerciseInput ex={q} answer={phase.answers[i]} onChange={() => {}} result={phase.results[i]} />
            <div className="rounded-lg bg-slate-900 p-3 text-sm [&_p]:my-1">
              {q.solution.answer && <p className="font-mono text-emerald-300">{q.solution.answer}</p>}
              <MarkdownView source={q.solution.explanation} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
