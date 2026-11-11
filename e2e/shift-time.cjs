// Adelanta o atrasa el reloj del servidor en las pruebas, para ver la planta de día o de noche a cualquier hora.
// Uso: TIME_SHIFT_MS=3600000 NODE_OPTIONS="--require ./e2e/shift-time.cjs" next start
// El navegador sigue la hora del servidor, así que basta con mover esta.
const shift = Number(process.env.TIME_SHIFT_MS || 0);
if (shift) {
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + shift);
      else super(...args);
    }
    static now() {
      return RealDate.now() + shift;
    }
  }
  globalThis.Date = ShiftedDate;
}
