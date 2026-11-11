import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { Logo } from "@/components/ui/logo";

/** Dato que la empresa debe completar con su abogado: se ve subrayado con una línea punteada. */
export function Ph({ children }: { children: React.ReactNode }) {
  return <span className="border-b border-dashed border-ink text-ink">{children}</span>;
}

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label={`${BRAND.name}, inicio`}>
            <Logo />
          </Link>
          <Link href="/" className="link text-sm text-fog">
            Volver al inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1240px] gap-x-16 px-5 pb-28 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Contenido" className="hidden lg:block">
          <ol className="sticky top-10 space-y-2.5 text-sm text-mute">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-3 hover:text-ink">
                  <span className="num w-5 shrink-0 text-dim">{i + 1}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0 max-w-[70ch]">
          {!LEGAL.reviewed && (
            <p role="note" className="mb-10 border-l-2 border-ink pl-4 text-sm leading-relaxed text-fog">
              <strong className="font-medium text-ink">Borrador para revisión legal.</strong> Este texto es una plantilla: un abogado debe revisarlo y completar los datos subrayados antes de usarlo con
              clientes reales.
            </p>
          )}
          <h1 className="display text-[clamp(2.75rem,7vw,5rem)]">{title}</h1>
          <p className="num mt-5 text-sm text-mute">
            {LEGAL.company} · Versión {LEGAL.version}
          </p>
          <div className="mt-8 text-lg leading-relaxed text-fog">{intro}</div>
          <div className="mt-12 border-t border-line-strong">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-8 border-b border-line py-9">
                <h2 id={`${s.id}-t`} className="flex gap-4 text-xl font-medium">
                  <span className="num w-6 shrink-0 text-mute" aria-hidden="true">
                    {i + 1}
                  </span>
                  {s.title}
                </h2>
                <div className="legal-body mt-4 space-y-4 pl-10 leading-relaxed text-fog">{s.body}</div>
              </section>
            ))}
          </div>
          <p className="mt-10 text-sm leading-relaxed text-mute">
            ¿Preguntas? Escríbenos a <Ph>{LEGAL.email}</Ph>. Consulta también los{" "}
            <Link href="/terminos" className="link text-fog">
              Términos y Condiciones
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" className="link text-fog">
              Política de Tratamiento de Datos
            </Link>
            .
          </p>
        </article>
      </main>
    </>
  );
}
