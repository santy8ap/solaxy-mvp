/** Decorative, code-native eclipse: no video, image download or canvas render loop. */
export function EclipseScene() {
  return (
    <div className="eclipse-scene" aria-hidden="true">
      <div className="eclipse-scene-depth">
        <div className="eclipse-starfield" />
        <div className="eclipse-orbit-track eclipse-orbit-track-one"><i /></div>
        <div className="eclipse-orbit-track eclipse-orbit-track-two" />
        <div className="eclipse-corona" />
        <div className="eclipse-corona-inner" />
        <div className="eclipse-disc" />
        <div className="eclipse-diamond" />
        <div className="eclipse-crosshair eclipse-crosshair-top" />
        <div className="eclipse-crosshair eclipse-crosshair-bottom" />
      </div>
      <span className="eclipse-scene-caption mono">EL ORIGEN DE TODO / EL SOL</span>
    </div>
  );
}

export function EnergyIntro() {
  return (
    <section className="energy-intro" aria-label="Energía solar para empresas">
      <div className="energy-ribbon" aria-hidden="true">
        <div className="energy-ribbon-track">
          {[0, 1].map((copy) => (
            <div className="energy-ribbon-group" key={copy}>
              <span>DEL SOL A TU EMPRESA.</span>
              <span className="energy-ribbon-spark">✳</span>
              <span className="energy-ribbon-outline">ENERGÍA QUE CONECTA.</span>
              <span className="energy-ribbon-spark">✳</span>
            </div>
          ))}
        </div>
      </div>
      <dl className="eclipse-wrap energy-facts">
        <div><dt>Ciclo solar proyectado</dt><dd className="mono">06—19 <span>h</span></dd></div>
        <div><dt>Planes para empresas</dt><dd className="mono">04 <span>escalas</span></dd></div>
        <div><dt>Contrato con pago mensual</dt><dd className="mono">03 <span>meses</span></dd></div>
      </dl>
    </section>
  );
}
