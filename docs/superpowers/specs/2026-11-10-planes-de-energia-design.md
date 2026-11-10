# Diseño: Solaxy por planes de energía (producción) y front "Eclipse"

**Fecha:** 10 de noviembre de 2026. Reemplaza el modelo de "comprar kW" (specs del 3 y 5 de noviembre). Los pagos (Mercado Pago, cripto), el acceso (Google, admin con PIN) y la seguridad de esos specs siguen vigentes.

## Lo que pidió el cliente

- Una página donde **empresas** compran **energía por planes** y ven que les genera **rendimientos diarios**.
- Solo planes de energía: desaparece la compra de kW, el mercado entre usuarios y la venta inmediata.
- Tabla de planes con precio por kWh y porcentaje (notas del cliente).
- Pago **mensual**. La energía del usuario debe **aumentar con el tiempo** mientras la mira.
- Reloj solar como el dibujo: campana de **6 a. m. a 7 p. m.**, con divisiones por hora y **máximo de 8.000 kW**.
- Front en blanco y negro, dirección **"Eclipse"** (elegida por el usuario). Código profesional, sin demos.

## Reglas del negocio

### Planes (contrato de 3 meses, 90 días)

| Plan | kWh en 3 meses | kWh al mes | kWh al día | Precio por kWh | Se vende a | Utilidad | Pago mensual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Plan 720 | 720.000 | 240.000 | 8.000 | $ 320 | $ 400 | 25 % | $ 76.800.000 |
| Plan 540 | 540.000 | 180.000 | 6.000 | $ 330 | $ 400 | 21 % | $ 59.400.000 |
| Plan 360 | 360.000 | 120.000 | 4.000 | $ 340 | $ 400 | 18 % | $ 40.800.000 |
| Plan 180 | 180.000 | 60.000 | 2.000 | $ 348 | $ 400 | 15 % | $ 20.880.000 |

- **Utilidad** = (precio de venta − precio del plan) ÷ precio del plan. Con los números del cliente da exactamente 25 %, 21,2 %, 17,6 % y 14,9 %: por eso el porcentaje se muestra como "Utilidad" (en las notas, "Ut.") y no como descuento.
- El precio de venta y el precio de cada plan los puede cambiar el admin. Cada plan comprado **guarda sus condiciones**: un cambio de precios solo aplica a planes nuevos.

### Pago mensual y periodos

- Cada pago confirmado activa un **periodo de 30 días** de energía (un tercio del plan).
- El primer periodo empieza cuando se confirma el pago. Si el siguiente mes se paga antes de que termine el periodo, el nuevo empieza al terminar el anterior; si se paga tarde, empieza al confirmarse (la energía estuvo **en pausa** mientras tanto).
- Si pasan **15 días** en pausa sin pagar, el plan se **cierra** y libera su cupo. No se pierde dinero: los meses no pagados simplemente no se generan.
- Un pago para un mes que ya estaba pagado queda **por reembolsar**.

### Energía, venta y saldo

- Curva solar (hora de Colombia, UTC−5): de 6:00 a 19:00, `potencia = 8.000 kW × sen(π·x)`, con `x` la fracción del día solar. Energía diaria de la planta: `8.000 × 13 × 2/π ≈ 66.208 kWh`.
- La energía de un plan sigue la misma curva: cada día solar completo entrega exactamente sus kWh diarios. Entre dos instantes: `kWh = kWhDiarios × (G(t₂) − G(t₁))`, con `G(t) = día + (1 − cos(π·x))/2`. Un periodo de 30 días entrega exactamente un tercio del plan.
- Cada kWh generado se abona al **precio de venta** ($ 400). `saldo = kWh generados × precio de venta − retiros − retiros en revisión`. `utilidad = kWh generados × (venta − precio del plan)`.
- **Cupo:** la suma de kWh diarios de los planes activos o en pausa no puede superar la energía diaria de la planta. Se verifica al crear la orden y, de forma atómica, al activar el periodo. Si no hay cupo cuando llega el pago, queda por reembolsar.
- El reloj solar es la **curva de generación** (un modelo), no una medición: así se rotula.

### Empresas y retiros

- Solo empresas: razón social, NIT (con dígito de verificación), representante legal (nombre y documento), celular, ciudad y aceptación de términos (nueva versión `2026-11-10`).
- Retiros: siempre los aprueba el admin, con la referencia del envío. Destinos: **cuenta bancaria a nombre de la empresa** (sin firma) o **wallet** en USDT (con firma de la wallet, como antes).

## Datos

- `plant`: `name`, `location`, `peak_kw`, `sale_cop_per_kwh`, `plan_prices` (JSON por id de plan), `updated_at`.
- `plan_subscription`: condiciones guardadas del plan (`plan_id`, `plan_name`, `total_kwh`, `months`, `daily_kwh`, `price_cop_per_kwh`, `sale_cop_per_kwh`), `started_at`, `cancelled_at`, `created_at`. Sin periodos es un **borrador** que el usuario no ve.
- `plan_period`: `subscription_id`, `idx` (único por plan), `starts_at`, `ends_at`, `kwh`, `amount_cop`, `tx_id` (único).
- `ledger_tx`: se quitan `kw` y `listing_id`; se agregan `subscription_id`, `period_index`, `kwh` y los datos bancarios del retiro. Tipos: `plan_mes` y `retiro`. Métodos: `mercadopago`, `crypto`, `manual` (pago registrado por el admin) y `demo` (pago de prueba, solo en modo de pruebas).
- `company_profile` (antes `investor_profile`): se agregan `company_name` y `nit`.
- Estado del plan **derivado** de sus periodos: `activa`, `en_pausa`, `completada`, `vencida`.
- **Migración 0003:** copia `ledger_tx` a `legacy_ledger_tx`, borra los movimientos y la comunidad ficticia del modelo anterior, elimina `position_entry`, `listing` y `telemetry`, y crea lo nuevo. Conserva cuentas, sesiones y perfiles. Las migraciones corren con un candado para que dos instancias no la apliquen a la vez.

## Servidor

- `config/plans.ts`, `config/solar.ts`; `lib/energy/solar-day.ts` y `lib/energy/plan-math.ts` (puros, compartidos con el navegador).
- `lib/plans/service.ts`: catálogo con cupo, resolver qué se paga, activar el periodo (idempotente y atómico).
- `lib/orders.ts`: `fulfillOrder` activa periodos en vez de asignar kW. Mercado Pago y cripto solo cambian qué se compra.
- `lib/portfolio.ts`: resumen del usuario (planes, kWh, venta, utilidad, saldo, movimientos).
- `lib/withdrawals.ts`: retiros a banco o wallet. `lib/platform.ts`: datos públicos.
- Admin: resumen, clientes, pago manual, pagos, retiros, planta y planes, bitácora, lista para cobrar de verdad.
- Se borra: `lib/sim`, `lib/telemetry`, `lib/live`, `lib/market.ts`, `portfolio-math`, mercado P2P, venta inmediata, ajuste de kW, modo presentación, comunidad ficticia y posición de regalo.
- En producción (`DEMO_MODE=false`) los pagos de prueba (Mercado Pago de pruebas o testnet) **no activan** planes.

## Front "Eclipse"

- **Color:** negro `#050505`, tinta `#f2f2f0`, grises. Sin color: los estados se distinguen con íconos, texto, relleno invertido y tachado.
- **Tipografía:** Archivo condensada (ancho 62 %, peso ligero, mayúsculas) para titulares y cifras grandes; Archivo normal para texto; IBM Plex Mono ligera para números. Las unidades conservan su forma (`kWh`, no `KWH`).
- **Forma:** esquinas rectas, líneas finas en vez de tarjetas, etiquetas en mayúsculas con espaciado, el eclipse como motivo de marca.
- **Reloj solar:** campana de 6 a. m. a 7 p. m., líneas verticales por hora, guías en 50 % (4.000 kW) y 100 % (8.000 kW), área recorrida rellena, el sol sobre la curva y la lectura de ahora. De noche indica cuándo vuelve a generar.
- **Pantallas:** inicio (eclipse, reloj, tabla de planes, cómo funciona, preguntas), ingreso, panel (Resumen, Planes, Movimientos, Empresa), resultado del pago, admin, términos y privacidad. En celular, barra inferior.
- Se respeta `prefers-reduced-motion`.

## Pruebas

- Unitarias (primero la prueba): curva solar, energía entre instantes, economía del plan, NIT, periodos y estados, cupo atómico, cumplimiento idempotente, pagos (Mercado Pago, cripto, prueba, manual), saldo y retiros, admin.
- De punta a punta con servicios falsos: comprar un plan con Mercado Pago, con cripto y con pago de prueba; pagar el mes siguiente; retirar; admin; modo producción.
- Recorrido visual en escritorio y celular, accesibilidad, desbordes y errores de consola.

## Fases

1. **E1 Dominio:** planes, curva, energía, NIT.
2. **E2 Servidor:** esquema y migración, planes y periodos, órdenes y pagos, portafolio, retiros, perfil, admin, rutas; borrar lo viejo.
3. **E3 Front:** sistema visual, reloj, inicio, ingreso, panel, pagos, admin, legal.
4. **E4 Recorrido y auditoría:** e2e, capturas, accesibilidad, informe de mejoras.
5. **E5 Entrega:** documentación, despliegue y verificación en producción.

## Supuestos por confirmar con el cliente

1. El usuario recibe la **venta** de su energía ($ 400 por kWh) y puede retirarla; la utilidad es la diferencia contra lo que pagó. Si en realidad la empresa **consume** la energía, se ocultan los retiros y la utilidad pasa a llamarse ahorro.
2. Los 8.000 kW son la **potencia máxima de la planta**. Con esa curva caben hasta 66.208 kWh diarios en planes.
3. Las condiciones legales (contrato de energía, captación, SARLAFT) las valida la empresa con su abogado; los textos legales conservan los espacios por definir.
