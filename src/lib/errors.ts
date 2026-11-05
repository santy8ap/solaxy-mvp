/** Error de negocio con estado HTTP y datos extra para la interfaz. */
export class MarketError extends Error {
  constructor(
    message: string,
    public status = 400,
    /** Datos extra para la interfaz (por ejemplo, un código o los campos con error) */
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}
