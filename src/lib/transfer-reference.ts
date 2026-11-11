/** Transferencias bancarias: lo que comparten la pantalla de pago, el admin y el servidor. Isomórfico. */

/** Lo que la empresa escribe en la descripción de la transferencia: el código del plan y el mes. */
export const transferReference = (subscriptionId: string, periodIndex: number) => `${subscriptionId}-M${periodIndex}`;
