/** La descarga del respaldo completo de los datos (lib/db/backup-format). */
export function BackupSection() {
  return (
    <section className="mt-16 border-t border-line-strong pt-8" aria-labelledby="backup-title">
      <h2 id="backup-title" className="text-xl font-medium">
        Respaldo de los datos
      </h2>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-mute">
        Una copia de todos los datos del negocio: los comercializadores y sus datos personales, los planes, los pagos, los retiros, las solicitudes y la bitácora. No incluye las sesiones ni los
        accesos de Google. Descarga uno cada semana y antes de cualquier cambio grande, y guárdalo cifrado: tiene datos personales. Cada descarga queda en la bitácora. Para restaurarlo en una base
        nueva, sigue la guía del README.
      </p>
      <a href="/api/admin/backup" download className="btn btn-ghost mt-6">
        Descargar respaldo
      </a>
    </section>
  );
}
