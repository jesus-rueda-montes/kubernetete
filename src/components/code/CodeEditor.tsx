import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { yaml } from '@codemirror/lang-yaml'
import { bracketMatching, indentOnInput, indentUnit, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { classHighlighter } from '@lezer/highlight'
import { useEffect, useRef, useState } from 'react'
import { hclStream } from './hclMode'

// Editor de código (CodeMirror 6). Se carga de forma diferida: solo se descarga
// al abrir un ejercicio de editor.

interface Props {
  language: 'yaml' | 'hcl'
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  ariaLabel?: string
}

const theme = EditorView.theme(
  {
    '&': { backgroundColor: '#020617', color: '#e2e8f0', fontSize: '14px' },
    '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', caretColor: '#34d399' },
    '.cm-gutters': { backgroundColor: '#0f172a', color: '#475569', border: 'none' },
    '.cm-activeLine': { backgroundColor: '#0f172a80' },
    '.cm-activeLineGutter': { backgroundColor: '#1e293b' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#1e3a8a !important' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: '#34d399' },
  },
  { dark: true },
)

export default function CodeEditor({ language, value, onChange, readOnly = false, ariaLabel = 'Editor de código' }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const readOnlyConf = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  // Props iniciales: el editor se crea una sola vez; los cambios posteriores
  // se aplican con los efectos de más abajo.
  const [initial] = useState(() => ({ language, value, readOnly, ariaLabel }))

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Crear el editor una sola vez.
  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial.value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          // YAML no admite tabuladores y en HCL se usan 2 espacios por convención.
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          initial.language === 'yaml' ? yaml() : StreamLanguage.define(hclStream),
          syntaxHighlighting(classHighlighter),
          theme,
          readOnlyConf.current.of(EditorState.readOnly.of(initial.readOnly)),
          EditorView.contentAttributes.of({ 'aria-label': initial.ariaLabel, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = v
    return () => v.destroy()
  }, [initial])

  // Sincronizar cambios externos (p. ej. "reiniciar").
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: readOnlyConf.current.reconfigure(EditorState.readOnly.of(readOnly)) })
  }, [readOnly])

  return <div ref={host} className="overflow-hidden rounded-lg border border-slate-700" />
}
