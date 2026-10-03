export default function Loading() {
  return <main id="content" role="status" aria-label="Carregando painel" className="mx-auto max-w-6xl space-y-4 p-8"><p>Carregando painel…</p>{[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="h-24 rounded-lg bg-muted motion-safe:animate-pulse" />)}</main>;
}
