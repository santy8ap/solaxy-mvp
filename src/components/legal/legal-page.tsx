import { FileWarning } from "lucide-react";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { Logo } from "@/components/ui/logo";

/** Dato que la empresa debe completar con su abogado. */
export function Ph({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-sun-400/15 px-1 text-sun-200">{children}</span>;
}

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <main className="relative min-h-dvh">
      <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <Logo />
        </Link>
        <Link href="/" className="text-sm text-silver-400 hover:text-silver-50">
          Volver al inicio
        </Link>
      </div>
      <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-5 pb-24 pt-6 sm:px-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Contenido" className="hidden lg:block">
          <ol className="sticky top-8 space-y-2 text-sm text-silver-400">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-silver-50">
                  <span className="num mr-2 text-silver-500">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="max-w-[72ch]">
          {!LEGAL.reviewed && (
            <div role="note" className="mb-8 flex gap-3 rounded-2xl border border-sun-400/40 bg-sun-400/10 p-4 text-sm leading-relaxed text-sun-200">
              <FileWarning size={20} className="mt-0.5 shrink-0" />
              <p>
                <strong>Borrador para revisión legal.</strong> Este texto es una plantilla: un abogado debe revisarlo y completar los datos
                resaltados antes de usarlo con inversionistas reales.
              </p>
            </div>
          )}
          <h1 className="display text-[clamp(2.2rem,4vw,3.2rem)] text-silver-50">{title}</h1>
          <p className="num mt-3 text-sm text-silver-500">
            {LEGAL.company} · Versión {LEGAL.version}
          </p>
          <div className="mt-6 text-[1.02rem] leading-relaxed text-silver-300">{intro}</div>
          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-8">
                <h2 id={`${s.id}-t`} className="text-xl font-semibold text-silver-50">
                  <span className="num mr-2 text-sun-300">{i + 1}.</span>
                  {s.title}
                </h2>
                <div className="legal-body mt-3 space-y-3 leading-relaxed text-silver-300">{s.body}</div>
              </section>
            ))}
          </div>
          <p className="mt-14 border-t border-silicon-600/50 pt-6 text-sm text-silver-500">
            ¿Preguntas? Escríbenos a <Ph>{LEGAL.email}</Ph>. Ver también{" "}
            <Link href="/terminos" className="text-sun-300 underline underline-offset-2">
              Términos y Condiciones
            </Link>{" "}
            y{" "}
            <Link href="/privacidad" className="text-sun-300 underline underline-offset-2">
              Política de Tratamiento de Datos
            </Link>
            .
          </p>
        </article>
      </div>
    </main>
  );
}
