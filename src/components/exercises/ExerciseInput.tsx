import type { Exercise } from '../../content/schema'
import type { Answer, GradeResult } from '../../engine/grade'
import { CommandInput } from './CommandInput'
import { EditorInput } from './EditorInput'
import { FillInput } from './FillInput'
import { QuizInput } from './QuizInput'

interface Props {
  ex: Exercise
  answer: Answer
  onChange: (a: Answer) => void
  result?: GradeResult
  onSubmit?: () => void
}

/** Selecciona el componente de entrada según el tipo de ejercicio. */
export function ExerciseInput({ ex, answer, onChange, result, onSubmit }: Props) {
  if (ex.type === 'quiz' && answer.type === 'quiz')
    return <QuizInput ex={ex} selected={answer.selected} onChange={(selected) => onChange({ type: 'quiz', selected })} result={result} />
  if (ex.type === 'fill' && answer.type === 'fill')
    return (
      <FillInput
        ex={ex}
        values={answer.values}
        onChange={(values) => onChange({ type: 'fill', values })}
        result={result}
        onSubmit={onSubmit}
      />
    )
  if (ex.type === 'command' && answer.type === 'command')
    return (
      <CommandInput
        ex={ex}
        text={answer.text}
        onChange={(text) => onChange({ type: 'command', text })}
        result={result}
        onSubmit={onSubmit}
      />
    )
  if (ex.type === 'editor' && answer.type === 'editor')
    return <EditorInput ex={ex} code={answer.code} onChange={(code) => onChange({ type: 'editor', code })} result={result} />
  return null
}
