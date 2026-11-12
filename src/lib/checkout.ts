/** Condiciones que el servidor presenta antes de pagar un mes del plan. */
export interface CheckoutRequest {
  planId?: string;
  subscriptionId?: string;
  planName: string;
  periodIndex: number;
  months: number;
  kwh: number;
  amountCop: number;
  priceCopPerKwh: number;
  saleCopPerKwh: number;
}
