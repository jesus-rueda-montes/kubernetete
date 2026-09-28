import { MarkdownView } from '../MarkdownView'

interface Props {
  hints: string[]
  revealed: number
  onReveal: () => void
}

export function HintPanel({ hints, revealed, onReveal }: Props) {
  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-amber-200">Pistas</span>
        {revealed < hints.length ? (
          <button
            type="button"
            onClick={onReveal}
            className="rounded-md border border-amber-700 px-3 py-1 text-sm text-amber-100 hover:bg-amber-900/40"
          >
            Ver pista {revealed + 1} de {hints.length}
          </button>
        ) : (
          <span className="text-xs text-amber-300/70">No hay más pistas</span>
        )}
      </div>
      <p className="mt-1 text-xs text-amber-300/70">Usar pistas no resta puntos ni afecta a tu progreso.</p>
      {revealed > 0 && (
        <ol className="mt-3 space-y-2">
          {hints.slice(0, revealed).map((h, i) => (
            <li key={i} className="flex gap-2 text-sm [&_p]:my-0">
              <span className="text-amber-400">{i + 1}.</span>
              <MarkdownView source={h} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
