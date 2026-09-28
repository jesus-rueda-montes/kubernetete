import { useState, type ReactNode } from 'react'

// Término con definición. Se abre al pasar el ratón, con el foco del teclado
// o tocándolo (móvil).
export function GlossaryTerm({ definition, children }: { definition: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative cursor-help border-b border-dotted border-sky-400"
      tabIndex={0}
      role="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-20 mb-2 block w-64 max-w-[80vw] rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm leading-5 font-normal text-slate-100 shadow-xl"
        >
          {definition}
        </span>
      )}
    </span>
  )
}
