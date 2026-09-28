export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-400">Pendiente: {phase}.</p>
    </section>
  )
}
