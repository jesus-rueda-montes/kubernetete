import type { CommandExercise } from '../../content/schema'
import { getCliSpec } from '../../content/loader'
import type { GradeResult } from '../../engine/grade'
import { Terminal, type TermLine } from '../Terminal'

interface Props {
  ex: CommandExercise
  text: string
  onChange: (text: string) => void
  result?: GradeResult
  onSubmit?: () => void
}

export function CommandInput({ ex, text, onChange, result, onSubmit }: Props) {
  const spec = getCliSpec(ex.cli)
  // Tras corregir se "ejecuta": se muestra el comando y su salida simulada
  // (si es correcto) o el motivo del fallo.
  const lines: TermLine[] = []
  if (result) {
    lines.push({ kind: 'cmd', text })
    if (result.correct) {
      if (ex.output) lines.push({ kind: 'out', text: ex.output })
    } else {
      lines.push({ kind: 'err', text: `✗ ${result.feedback ?? 'No es el comando que se pide.'}` })
    }
  }
  return <Terminal spec={spec} value={text} onChange={onChange} onSubmit={onSubmit} lines={lines} disabled={!!result} />
}
