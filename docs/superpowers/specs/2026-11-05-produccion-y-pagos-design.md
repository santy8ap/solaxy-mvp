# Diseño: Solaxy listo para producción, con pagos reales (Wompi y cripto directo)

**Fecha:** 5 de noviembre de 2026.

## Objetivo

Que la plataforma funcione de verdad: los usuarios pagan con **tarjeta, PSE o Nequi (Wompi)** o con **cripto (USDT o BNB en BNB Chain) directo a la billetera de la empresa**, y los kW se asignan **solo cuando el pago está confirmado**. Además, el proyecto queda endurecido para producción.

## Decisiones confirmadas por el usuario

- **Tarjetas, PSE y Nequi:** Wompi, con su Web Checkout (redirección).
- **Cripto:** directo a la wallet de la empresa, con verificación en la blockchain. Sin procesador.
- **Cobros reales:** el sistema queda listo para cobrar apenas se configuren las llaves de producción. La validación legal (empresa, KYC y Superintendencia Financiera) corre por cuenta de la empresa.
- **Planta:** sigue simulada y marcada como tal hasta que exista la real.

## 1. Compra con Wompi (tarjeta, PSE, Nequi)

1. Si al usuario le faltan sus **datos de inversionista** o no ha aceptado los términos, se le piden primero (sección 4).
2. El servidor crea la orden **pendiente** con una referencia única y arma la URL de Web Checkout. La firma de integridad se calcula **en el servidor**: `SHA256(referencia + montoEnCentavos + "COP" + secretoDeIntegridad)`. También se prellenan el correo, el nombre, el teléfono y el documento.
3. El usuario paga en Wompi y vuelve a `/pagos/resultado?id=<transacción>`.
4. Hay **dos vías de confirmación**, y las dos son idempotentes:
   - **Webhook** `/api/webhooks/wompi`. Se verifica el checksum: SHA256 de los valores de `signature.properties` en orden, más el `timestamp`, más el secreto de eventos.
   - **Consulta directa** a `GET /v1/transactions/{id}` cuando el usuario vuelve a la página.
   - En ambos casos se verifica que la referencia, el monto y la moneda coincidan con la orden. La orden pasa de `pendiente` a `confirmada` con un UPDATE condicional, así que **los kW se asignan una sola vez** aunque lleguen el webhook y la consulta al mismo tiempo.
5. Según el estado de Wompi:
   - `APPROVED` → se asignan los kW, con celebración.
   - `DECLINED`, `VOIDED` o `ERROR` → la orden queda fallida y se muestra el motivo.
   - `PENDING` (PSE) → "Procesando tu pago", y la página se actualiza sola.
6. **Sandbox o producción** lo decide la llave pública (`pub_test_…` o `pub_prod_…`); el código es el mismo.

## 2. Compra con cripto directo (BNB Chain)

1. Datos del inversionista y términos, igual que arriba.
2. Se conecta la wallet: Trust Wallet o MetaMask, o el celular por QR. Si está en otra red, se le pide **cambiar a BNB Chain**.
3. **Cotización:**
   - El servidor cotiza con el precio en vivo de CoinGecko. **Si no hay precio en vivo, no se cotiza**: con dinero real no se usan precios de referencia.
   - Crea la orden con el **monto exacto** en USDT o BNB y una vigencia de 20 minutos.
4. **Pago:** la wallet envía la transacción: BNB nativo, o `transfer` de USDT (BEP-20) a la **billetera de la empresa**.
5. **Verificación en la blockchain:**
   - El recibo debe ser exitoso, con **N confirmaciones** (5 por defecto).
   - El destino debe ser la billetera de la empresa y el origen, la wallet de la orden.
   - El monto debe ser **mayor o igual** al cotizado.
   - Para USDT se valida el evento `Transfer` del contrato oficial.
   - El **hash no puede haberse usado antes** (índice único en la BD).
   - Estados: `verificando` → `confirmada`, o `fallida` con el motivo (por ejemplo, monto incompleto).
6. **Reintentos:** si el usuario cierra la pestaña, la verificación se reintenta cuando abre su panel. El admin también tiene un botón **Re-verificar**.
7. **Red de pruebas:** `CRYPTO_NETWORK=bsc-testnet` usa la testnet de BNB Chain para probar sin dinero real.

## 3. Retiros (salida de dinero real)

- En modo real, **siempre pasan por el admin**. Al aprobar, el admin escribe la **referencia del envío** (hash de la transacción o comprobante bancario); ya no hay hashes simulados.
- Mientras la planta sea simulada, las ganancias se muestran como **"estimadas"** y el interruptor de aprobación de retiros **no se puede apagar**.

## 4. Datos del inversionista y cumplimiento básico

- **Perfil:** nombre completo, tipo de documento (CC, CE, PP o NIT), número, teléfono y ciudad. Es obligatorio antes de la primera compra (Wompi también los usa).
- **Aceptación** de los Términos y Condiciones y de la Política de Tratamiento de Datos (Ley 1581 de 2012), guardada con versión y fecha.
- Páginas `/terminos` y `/privacidad` como **plantillas para que las revise su abogado**.
- El admin ve el perfil de cada usuario en Usuarios.

## 5. Modo demo y modo producción

- **`DEMO_MODE`:** activo por defecto en local. **Solo** en modo demo existen la cuenta demo, la wallet demo, el pago simulado, la posición de regalo y el QR de BTC simulado.
- **Con `DEMO_MODE=false`** (salida en vivo): se ingresa con Google y solo se paga con Wompi y cripto real.
- En Vercel se mantiene en `true` hasta que estén configurados Google, Wompi y la billetera. Una **lista de verificación en el admin** muestra qué falta.

## 6. Seguridad y operación

- **Claves:** en producción la app **no arranca** sin `BETTER_AUTH_SECRET`; nunca usa la clave de respaldo.
- **Encabezados de seguridad:** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy.
- **Límites:** máximo de intentos al crear órdenes, por usuario.
- **Registro:** los eventos de pago se registran estructurados (JSON) en los logs de Vercel.
- **Nueva sección "Pagos" en el admin:**
  - Órdenes con método, estado, referencia de Wompi o hash (con enlace a BscScan).
  - Botón **Re-verificar**.
  - **Lista de configuración** que muestra qué falta por conectar.

## 7. Variables nuevas

| Variable | Para qué |
| --- | --- |
| `WOMPI_PUBLIC_KEY` | Llave pública: `pub_test_…` o `pub_prod_…` |
| `WOMPI_INTEGRITY_SECRET` | Firma del checkout |
| `WOMPI_EVENTS_SECRET` | Verificar los webhooks |
| `CRYPTO_TREASURY_ADDRESS` | Dirección **pública** de la billetera de la empresa |
| `CRYPTO_NETWORK` | `bsc` o `bsc-testnet` |
| `BSC_RPC_URL` | Opcional, si se usa un nodo propio |
| `CRYPTO_CONFIRMATIONS` | Opcional, por defecto 5 |
| `USDT_CONTRACT` | Opcional. Por defecto el USDT oficial de BNB Chain |
| `DEMO_MODE` | `true` o `false` |
| `COINGECKO_API_KEY` | Opcional, para más límite de consultas |

## 8. Lo que necesito del usuario

1. Conectar **Turso** en Vercel.
2. Una **cuenta Wompi**: las llaves de prueba (y después las de producción), y configurar la URL de eventos `https://<dominio>/api/webhooks/wompi`.
3. La **dirección pública** de la billetera de la empresa. **Nunca** la frase semilla.
4. Las **credenciales de Google** OAuth.

## 9. Pruebas

- **TDD:**
  - La firma de integridad y el checksum de eventos, con vectores calculados.
  - El mapeo de estados de Wompi y el cumplimiento idempotente (webhook duplicado, webhook más consulta a la vez).
  - La verificación cripto con transacciones construidas: BNB, `Transfer` de USDT, origen, destino, monto, confirmaciones y hash repetido.
  - El perfil y los términos, y `DEMO_MODE`.
- **Playwright:**
  - Los flujos con un Wompi y una cadena falsos, inyectados solo en pruebas.
  - El perfil, los términos, el admin de Pagos y la lista de configuración.
- **Límite conocido:** desde esta sesión no hay acceso a Wompi ni a BNB Chain. La prueba real de punta a punta se hace en Vercel con las llaves de prueba de Wompi y la testnet, siguiendo un guion paso a paso que queda en el README.

## 10. Orden de implementación

1. Esquema `0002`: perfil, método y proveedor en las órdenes, índice único de hashes. Más `DEMO_MODE` y la seguridad básica.
2. Perfil del inversionista, términos y privacidad.
3. Wompi: checkout firmado, retorno, webhook y verificación.
4. Cripto directo: cotización, envío desde la wallet, verificación en la blockchain y reintentos.
5. Retiros con referencia real, más la sección Pagos y la lista de configuración del admin.
6. Interfaz de pago nueva. Después, las mejoras visuales pendientes (hero cinematográfico y animaciones).
7. Verificación, guía de salida a producción y despliegue.

## Fuera de alcance

- Retiros a cuenta bancaria automatizados (el admin paga manualmente).
- Verificación de identidad con documento y selfie a través de un proveedor de KYC.
- Telemetría real (no hay planta todavía).
- Cripto distinta de USDT y BNB en BNB Chain.
