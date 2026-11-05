# Solaxy: MVP de inversión en energía solar

Solaxy permite comprar **kW de una planta solar** pagando con **tarjeta, PSE o Nequi (Mercado Pago)** o con **USDT y BNB directo a la billetera de la empresa**, y ver en vivo la telemetría de la planta y cómo crecen las ganancias, segundo a segundo.

Funciona en dos modos (sección 9):

- **Modo demo** (`DEMO_MODE=true`, por defecto): cuenta demo, wallet demo, pagos simulados e inversionistas de ejemplo. Ideal para presentar.
- **Producción** (`DEMO_MODE=false`): solo Google para entrar y solo pagos reales; los kW se asignan cuando el pago queda confirmado.

Lo que incluye:

- **Landing:** el sol aparece en su posición real sobre la planta y los paneles se iluminan según la potencia. Incluye el mapa de propiedad de la planta, un simulador de inversión, los métodos de pago y preguntas frecuentes.
- **Ingreso:** con Google o con la cuenta demo, que no necesita configurar nada.
- **Panel:**
  - Ganancias en vivo y flujo de energía animado (sol → paneles → batería → red → tu billetera).
  - Crecimiento de la inversión (90 días) y ganancias por día (30 días).
- **Telemetría:** potencia, irradiancia, temperaturas, tensiones, frecuencia, batería, 10 inversores y la curva del día.
- **Mercado:**
  - Compra a la planta o a otros usuarios (P2P) con Mercado Pago, con USDT o BNB desde tu wallet, o con el pago simulado (solo modo demo).
  - Venta inmediata y publicación de ofertas.
- **Billetera:** saldo, retiros firmados a tu wallet (los aprueba el admin) e historial con enlaces a BscScan.
- **Mis datos:** datos del inversionista y aceptación de los Términos y la Política de Datos, obligatorios antes de pagar.
- **Administración:** usuarios, retiros, pagos (re-verificar y reembolsos), planta, actividad y la lista de lo que falta para cobrar de verdad.
- **Vista de socios:** capital levantado, porcentaje de la planta vendido, ingresos y la parte de la plataforma.
- **Modo presentación:** muestra la planta al mediodía, al amanecer o a las 7 p. m., y acelera el tiempo.

---

## 1. Requisitos

- **Node.js 22 LTS** (sirve desde la 20.9). Descárgalo de <https://nodejs.org> y revisa con `node -v`.
- Git, si vas a clonar el repositorio.

## 2. Correrlo en tu PC (Windows, macOS o Linux)

### Opción A: clonar con VSCodium

1. En VSCodium presiona `Ctrl+Shift+P`, escribe **Git: Clone** y pega `https://github.com/santy8ap/solaxy-mvp`.
2. Elige tu carpeta **Documentos** y abre el proyecto.

O desde una terminal de PowerShell:

```bash
cd $HOME\Documents
```

```bash
git clone https://github.com/santy8ap/solaxy-mvp solaxy
```

### Opción B: archivo .zip

Descomprime el .zip dentro de `Documentos\solaxy`, de modo que `package.json` quede en la raíz de la carpeta.

### Instalar y arrancar

Abre una terminal en la carpeta del proyecto (en VSCodium: **Terminal → Nueva terminal**):

```bash
npm install
```

```bash
npm run presentar
```

Después abre <http://localhost:3000>. El comando `presentar` hace cuatro cosas:

1. Crea `.env.local` con una clave secreta aleatoria.
2. Compila en modo producción, que es más rápido y fluido para la reunión.
3. Arranca el servidor.
4. La **base de datos se crea sola** en `data/solaxy.db` con los datos de ejemplo la primera vez que abres la app.

Para editar el código con recarga automática usa `npm run dev`.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run presentar` | Prepara, compila y arranca en modo producción (para la reunión) |
| `npm run dev` | Modo desarrollo con recarga en vivo |
| `npm run reset-demo` | Borra la base de datos local para empezar la demo desde cero |
| `npm test` | Corre las pruebas (motor solar, ganancias, firmas y telemetría) |
| `npm run setup` | Solo crea `.env.local` y revisa la configuración |

---

## 3. Cuentas para la demo

- **Entrar con la cuenta demo**: funciona siempre, incluso sin internet. Es un inversionista con 12 kW, comprados hace 90 y 28 días, y con historial.
- **Continuar con Google**: necesita las credenciales (sección 4). En modo demo, cada cuenta nueva recibe **5 kW de demostración con 30 días de historial** para que el panel se vea vivo. Se desactiva con `DEMO_STARTER_KW=0`.
- **Administrador**: al ingresar, elige *Administrador* y escribe el PIN. `npm run setup` genera uno aleatorio y lo muestra una vez; queda en `.env.local` como `ADMIN_PIN`. Si tu `.env.local` no tiene `ADMIN_PIN`, en tu PC el PIN de demostración es `2026`. En Vercel vale el PIN de la variable `ADMIN_PIN`.

## 4. Configurar Google (unos 10 minutos, opcional)

1. Entra a <https://console.cloud.google.com> y crea un proyecto, por ejemplo **Solaxy**.
2. Abre **APIs y servicios → Pantalla de consentimiento de OAuth**. Elige **Externo**, ponle el nombre Solaxy y tu correo, y guarda.
3. Mientras la app esté en modo **Prueba**, agrega en **Usuarios de prueba** los correos que van a entrar, por ejemplo los de tus socios.
4. Abre **Credenciales → Crear credenciales → ID de cliente de OAuth** y elige **Aplicación web**:
   - **Orígenes de JavaScript autorizados:** `http://localhost:3000`
   - **URI de redireccionamiento autorizados:** `http://localhost:3000/api/auth/callback/google`
5. Copia el **ID de cliente** y el **Secreto** en `.env.local`:

   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```

6. Vuelve a correr `npm run presentar`.

## 5. Trust Wallet y cripto

Hay dos formas de pagar con la wallet:

- **Pago real** (USDT o BNB en BNB Chain, si `CRYPTO_TREASURY_ADDRESS` está configurada): la wallet envía el monto exacto a la billetera de la empresa y el servidor lo verifica en la cadena (sección 9).
- **Pago simulado** (solo en modo demo): firmas la orden y el servidor verifica criptográficamente que la firma corresponde a tu dirección, pero ninguna firma mueve fondos.

- **En el computador:** instala la extensión de **Trust Wallet** (o MetaMask) en Chrome o Brave. Aparece sola en **Conectar wallet**.
- **Desde el celular con QR (WalletConnect):**
  1. Crea un Project ID gratis en <https://dashboard.reown.com>.
  2. Ponlo en `.env.local` como `NEXT_PUBLIC_REOWN_PROJECT_ID=...`.
  3. Vuelve a correr `npm run presentar`.
  4. En la app elige **Trust Wallet en tu celular**, escanea el código con Trust Wallet y aprueba la firma en el teléfono.
- **Wallet de demostración** (solo modo demo): genera una clave en el navegador que firma de verdad pero no tiene fondos. Es la opción más segura para la presentación. No sirve para pagos reales.
- **Bitcoin por QR** (solo modo demo): el flujo es simulado y el código **no** es una dirección real, así que no envíes fondos.

Las tasas vienen de CoinGecko. En el pago simulado, si no hay internet, se usan precios de referencia. En el pago real nunca: sin precio en vivo no se cotiza.

## 6. Modo presentación

Presiona la tecla **P** (fuera de campos de texto) o usa **Modo presentación** en el menú del panel. Puedes:

- Ver la planta al **mediodía**, al **amanecer** o a las **7 p. m.** A esa hora la batería está entregando energía en la hora pico.
- Acelerar el tiempo **×60** o **×600**: el sol se mueve y las ganancias suben rápido.

Mientras está activo se ve el aviso **"Simulación"**. Nada de lo simulado se guarda en la base de datos. Para volver, elige **Hora real**.

---

## 7. Publicar con un link (Vercel)

1. En <https://vercel.com> elige **Add New → Project** e importa `santy8ap/solaxy-mvp`.
2. Crea una base de datos gratuita en **Turso**, en <https://turso.tech> o desde el Marketplace de Vercel, y copia su URL y su token.
3. En **Settings → Environment Variables** agrega:
   - `BETTER_AUTH_SECRET`: una clave larga aleatoria. En Vercel la app no arranca sin ella.
   - `ADMIN_PIN`: el PIN de administrador. Sin él, en Vercel nadie puede entrar al admin.
   - `BETTER_AUTH_URL`: por ejemplo `https://tu-proyecto.vercel.app`.
   - `DEMO_MODE`: `true` mientras presentas; `false` para cobrar de verdad (sección 9).
   - `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (las crea Vercel → Storage → Turso).
   - Las de Google, Mercado Pago y cripto de la sección 9.
4. Si usas Google, agrega `https://tu-proyecto.vercel.app/api/auth/callback/google` en los URI de redireccionamiento.
5. Despliega. La base de datos se crea y se siembra sola en la primera visita.

Sin Turso también funciona, pero con una base de datos temporal que se reinicia cuando Vercel reinicia el servidor. La lista de configuración del admin (Admin → Pagos) lo marca como pendiente.

---

## 8. Cómo funciona por dentro

| Pieza | Tecnología |
| --- | --- |
| Web | Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, Motion, Recharts |
| Base de datos | SQLite / libSQL con Drizzle ORM. Archivo local, o Turso en la nube |
| Autenticación | Better Auth: Google OAuth y cuenta demo |
| Wallets | viem, EIP-6963 (extensiones) y WalletConnect (QR) |
| Tiempo real | Server-Sent Events: una lectura de la planta cada 2 s |

- **Motor de la planta (`src/lib/sim`):**
  - La posición del sol sale de las ecuaciones de NOAA y el cielo despejado del modelo de Haurwitz.
  - Las nubes son deterministas (más nubes en las tardes, como en Antioquia).
  - La potencia depende de la temperatura y se recorta a la capacidad AC.
  - La batería carga entre 9:30 y 15:00 y vende en hora pico, de 18:00 a 22:00.
  - Es determinista: el mismo instante siempre da el mismo valor, en el servidor y en el navegador.
- **Telemetría guardada (`src/lib/telemetry`):** intervalos de 15 minutos en la base de datos, desde la puesta en marcha. Se rellenan solos al consultar, sin cron.
- **Ganancias:** `ganancia = Σ kW × (C(ahora) − C(compra))`. C es el ingreso neto acumulado por kWp de la planta: energía entregada × tarifa × 82 %. Una venta corta las ganancias de esos kW desde ese momento.
- **Firmas (`src/lib/signing.ts`):** la orden se firma con `personal_sign` (EIP-191) y el servidor la verifica con `viem.verifyMessage`.
- **Configuración en un solo lugar:**
  - `src/config/plant.ts`: la planta.
  - `src/config/economics.ts`: precio, tarifas y comisión.
  - `src/config/brand.ts`: la marca.
  - `src/app/globals.css`: los colores.

### Qué es real y qué es simulado

| | Modo demo | Producción |
| --- | --- | --- |
| Login, sesiones y base de datos | Real | Real (solo Google) |
| Pagos con Mercado Pago y con cripto (USDT y BNB en BNB Chain) | Reales si están configurados (credenciales de prueba o testnet para probar) | Reales |
| Pago simulado (firma sin mover fondos) y QR de Bitcoin | Disponibles | No existen |
| Inversionistas y ofertas de ejemplo | Sí | No |
| La planta y su telemetría | Simuladas (modelo físico realista) | Simuladas hasta conectar los medidores: las ganancias se muestran como estimadas |
| Retiros | El admin decide si requieren aprobación | Siempre los aprueba el admin y registra la referencia del envío |

## 9. Salir en vivo con pagos reales

La app tiene dos modos, que se eligen con `DEMO_MODE`:

| | Modo demo (`DEMO_MODE=true`) | Producción (`DEMO_MODE=false`) |
| --- | --- | --- |
| Ingreso | Google y cuenta demo | Solo Google |
| Pagos | Mercado Pago y cripto si están configurados, más el pago simulado | Solo Mercado Pago (tarjeta, PSE, Nequi) y cripto real (USDT y BNB en BNB Chain) |
| Inversionistas y ofertas de ejemplo | Sí | No |
| Retiros | El admin decide si requieren aprobación | Siempre los aprueba el admin, con la referencia del envío |
| Administración | PIN | PIN y correo en `ADMIN_EMAILS` |

La planta sigue simulada en los dos modos hasta conectar sus medidores, así que las ganancias se muestran como **estimadas**.

### Cómo se confirma un pago

- **Mercado Pago (tarjeta, PSE, Nequi):**
  - El servidor crea la orden y una preferencia del Checkout Pro con el monto exacto y la orden como referencia. El usuario paga en Mercado Pago y vuelve a `/pagos/resultado`.
  - Nequi y Daviplata se pagan desde PSE: el usuario elige PSE y luego su billetera.
  - El pago se confirma por dos vías: las notificaciones de Mercado Pago (con su firma verificada) y una consulta directa a su API cuando el usuario vuelve. En ambas, el pago se lee de la API de Mercado Pago y se valida la referencia, el monto y la moneda; los kW se asignan **una sola vez**.
  - PSE puede quedar "en proceso" unos minutos; la página se actualiza sola. Si alguien paga dos veces la misma orden, el segundo pago queda **Por reembolsar**.
- **Cripto directo (USDT o BNB en BNB Chain):**
  - El servidor cotiza con el precio en vivo de CoinGecko. **Si no hay precio en vivo, no se cotiza.** La cotización dura 20 minutos.
  - La wallet del usuario (Trust Wallet o MetaMask) envía el monto exacto a la billetera de la empresa.
  - El servidor verifica en la cadena:
    - El recibo es exitoso y tiene las confirmaciones pedidas.
    - El pago salió de la wallet de la orden y llegó a la billetera de la empresa.
    - El monto es igual o mayor al cotizado.
    - En USDT, el evento `Transfer` es del contrato oficial.
    - El hash no se había usado antes.
- **Si algo sale mal:** un pago que llegó pero no se pudo asignar (sin cupo, oferta ya vendida, monto incompleto o tardío) queda **Por reembolsar** en Admin → Pagos.

### Paso a paso

1. **Base de datos.** En Vercel → Storage → Turso, conéctala al proyecto. Crea sola `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
2. **Google.** Sigue la sección 4. En producción, el URI de redireccionamiento es `https://<tu-dominio>/api/auth/callback/google`.
3. **Administradores.** Además de `ADMIN_PIN`, pon en `ADMIN_EMAILS` los correos de Google de quienes administran, separados por comas.
4. **Mercado Pago.**
   - Crea la cuenta en <https://www.mercadopago.com.co>. Sirve como persona natural.
   - Entra a **Tus integraciones** (<https://www.mercadopago.com.co/developers/panel/app>), pulsa **Crear aplicación** y elige pagos en línea con **Checkout Pro**.
   - En **Credenciales de prueba**, copia el **Access Token** en `MERCADOPAGO_ACCESS_TOKEN`. La Public Key no se necesita.
   - En **Webhooks → Configurar notificaciones**, pon la URL `https://<tu-dominio>/api/webhooks/mercadopago` con el evento **Pagos**. Si el panel separa el modo de prueba del productivo, pon la misma URL en los dos. Copia la **clave secreta** en `MERCADOPAGO_WEBHOOK_SECRET`.
   - Solo cuentan esas notificaciones, que vienen firmadas: la app no pide `notification_url` por pago e ignora los avisos IPN antiguos, que no tienen firma.
   - Cuando todo funcione, activa las **credenciales de producción** y reemplaza el Access Token (y la clave secreta, si cambia).
   - Los dos valores se pegan directamente en Vercel.
5. **Billetera de la empresa.**
   - Pon solo su dirección **pública** (`0x…`) en `CRYPTO_TREASURY_ADDRESS`.
   - **Nunca** compartas la frase semilla ni la guardes en la app.
   - Para la tesorería conviene una wallet de hardware o una multifirma.
6. **Revisa la lista.** En Admin → Pagos → *Para cobrar de verdad*, pulsa **Probar conexiones**. La lista muestra el nombre exacto de cada variable que falta y prueba la cuenta de Mercado Pago (que sea de Colombia y si es de prueba), el nodo de BNB Chain y el precio de CoinGecko.
7. **Prueba de punta a punta, sin dinero real**, todavía con `DEMO_MODE=true`:
   - **Mercado Pago de prueba:**
     - Con las credenciales de prueba, compra 0,5 kW.
     - Mercado Pago no deja pagarte con tu propia cuenta: en **Tus integraciones → Cuentas de prueba**, crea un comprador de prueba y paga con él.
     - Usa las tarjetas de prueba de la documentación de Mercado Pago. El nombre del titular decide el resultado: `APRO` se aprueba y `OTHE` se rechaza.
   - **Cripto en testnet:**
     - Usa `CRYPTO_NETWORK=bsc-testnet` y consigue tBNB en el faucet de BNB Chain: <https://www.bnbchain.org/en/testnet-faucet>.
     - Compra 0,1 kW pagando con BNB desde MetaMask.
     - Mira la transacción en <https://testnet.bscscan.com>.
   - **Revisa en Admin → Pagos** que los pagos queden confirmados sin pulsar *Re-verificar*. Así sabes que el webhook llega.
8. **Salida en vivo:**
   - Pon las credenciales de producción de Mercado Pago, `CRYPTO_NETWORK=bsc` y `DEMO_MODE=false`, y vuelve a desplegar.
   - En Admin → Pagos, pulsa **Borrar datos de demostración**. Solo se puede antes del primer pago real.
9. **Legal.**
   - Completa los datos de la empresa en `src/config/legal.ts`. Pon `reviewed: true` cuando el abogado apruebe los textos de `/terminos` y `/privacidad`.
   - La validación legal (estructura de la oferta, SARLAFT y Superintendencia Financiera) corre por cuenta de la empresa.

### Operación diaria

- **Retiros.** En Admin → Retiros, envía el dinero a la dirección que aparece. Al aprobar, pega la referencia del envío (el hash de la transacción o el número del comprobante).
- **Pagos.** En Admin → Pagos puedes:
  - re-verificar un pago en proceso;
  - registrar el hash de un pago cripto, si el usuario cerró la pestaña antes de que se registrara;
  - marcar un reembolso.
- **Registros.** Cada evento de pago queda como una línea JSON en los logs de Vercel. Filtra por `"tipo":"pago"`.
- **Venta inmediata.** Con dinero real, la plataforma recompra los kW al 97 % del precio y ese saldo se paga por retiro. Decide si quieres mantenerla.

### Variables

| Variable | Para qué |
| --- | --- |
| `DEMO_MODE` | `true` (demo) o `false` (cobros reales) |
| `BETTER_AUTH_SECRET` | Firma las sesiones. Obligatoria en Vercel |
| `BETTER_AUTH_URL` | URL pública de la app |
| `ADMIN_PIN` | PIN del administrador |
| `ADMIN_EMAILS` | Correos de los administradores. Obligatoria con `DEMO_MODE=false` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ingreso con Google |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token: `TEST-…` (pruebas) o `APP_USR-…` (producción) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Clave secreta que firma las notificaciones |
| `CRYPTO_TREASURY_ADDRESS` | Dirección pública de la billetera de la empresa |
| `CRYPTO_NETWORK` | `bsc` o `bsc-testnet` |
| `CRYPTO_CONFIRMATIONS` | Confirmaciones antes de asignar los kW (5 por defecto) |
| `BSC_RPC_URL` | Opcional: nodo propio de BNB Chain |
| `USDT_CONTRACT` | Opcional: contrato del USDT (por defecto, el oficial) |
| `COINGECKO_API_KEY` | Opcional: más límite de consultas de precios |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos en la nube |

## 10. Pruebas

- **Unitarias.** `npm test` cubre la preferencia del checkout y la firma de las notificaciones de Mercado Pago, la verificación cripto con transacciones construidas, el cumplimiento idempotente de las órdenes, el perfil, el modo demo y el admin.
- **De punta a punta, con servicios falsos y sin internet.** En `e2e/` hay un Mercado Pago falso, una BNB Chain falsa y una wallet EIP-6963 que se inyecta en el navegador. Cada comando va en su propia terminal:

```bash
MP_WEBHOOK_SECRET=mp_secret_e2e WEBHOOK_URL=http://localhost:3000/api/webhooks/mercadopago node e2e/fake-mercadopago.mjs
```

```bash
node e2e/fake-chain.mjs
```

```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-e2e MERCADOPAGO_WEBHOOK_SECRET=mp_secret_e2e MERCADOPAGO_API_BASE=http://localhost:4010 CRYPTO_TREASURY_ADDRESS=0x8ba1f109551bD432803012645Ac136ddd64DBA72 CRYPTO_CONFIRMATIONS=3 BSC_RPC_URL=http://localhost:4020/rpc COINGECKO_API_BASE=http://localhost:4020/coingecko npm run dev
```

```bash
node e2e/mercadopago-flow.cjs && node e2e/crypto-flow.cjs && node e2e/demo-and-profile.cjs && node e2e/admin-flow.cjs
```

## 11. Próximos pasos

1. **Conectar la planta real.** Hay que implementar una fuente de telemetría que lea el inversor (por ejemplo, la API de Huawei FusionSolar, SMA o Fronius, o Modbus TCP) en lugar del modelo. Los cálculos de ganancias no cambian.
2. **Verificación de identidad.** Un proveedor de KYC (documento y selfie) además de los datos del inversionista.
3. **Retiros automáticos.** Hoy el admin paga a mano y registra la referencia.
4. **Operación.** Monitoreo y alertas, respaldos de Turso y una auditoría de seguridad externa antes de recibir montos grandes.

## 12. Solución de problemas

- **"Port 3000 is already in use":** cierra la otra app que usa el puerto o detén el servidor anterior con `Ctrl+C`.
- **`npm install` falla en un Windows con procesador ARM:** el driver local de SQLite no trae binario para ARM. Usa Turso (sección 7) definiendo `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
- **Google dice `redirect_uri_mismatch`:** el URI de redireccionamiento debe ser exactamente `http://localhost:3000/api/auth/callback/google`.
- **No aparece mi extensión de wallet:** recarga la página con la extensión desbloqueada, o usa la wallet de demostración.
- **Quiero empezar la demo de cero:** corre `npm run reset-demo` y vuelve a arrancar.
- **Los pagos de Mercado Pago no se confirman solos (no llegan las notificaciones):**
  - Revisa que la URL de Webhooks en Mercado Pago sea `https://<tu-dominio>/api/webhooks/mercadopago`, con el evento **Pagos**.
  - Revisa que `MERCADOPAGO_WEBHOOK_SECRET` sea la clave secreta de esa misma aplicación.
  - Las notificaciones rechazadas quedan en los logs como `webhook_rechazado`.
  - Mientras tanto, el pago se confirma cuando el usuario vuelve de Mercado Pago, o con *Re-verificar* en Admin → Pagos.
- **"No hay precio en vivo de las criptomonedas":** CoinGecko no respondió. Si pasa seguido, agrega `COINGECKO_API_KEY` (hay un plan gratuito). Con dinero real nunca se cotiza con precios de referencia.
- **"El nodo de BNB Chain configurado está en otra red":** `BSC_RPC_URL` apunta a una red distinta de `CRYPTO_NETWORK`, por ejemplo un nodo de testnet con `CRYPTO_NETWORK=bsc`.
