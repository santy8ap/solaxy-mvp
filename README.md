# Solaxy: MVP de inversión en energía solar

Solaxy permite comprar **kW de una planta solar** pagando con **Trust Wallet o cripto** y ver en vivo la telemetría de la planta y cómo crecen las ganancias, segundo a segundo.

Este repositorio es un **MVP demostrativo** que funciona de punta a punta:

- **Landing:** el sol aparece en su posición real sobre la planta y los paneles se iluminan según la potencia. Incluye el mapa de propiedad de la planta, un simulador de inversión, los métodos de pago y preguntas frecuentes.
- **Ingreso:** con Google o con la cuenta demo, que no necesita configurar nada.
- **Panel:**
  - Ganancias en vivo y flujo de energía animado (sol → paneles → batería → red → tu billetera).
  - Crecimiento de la inversión (90 días) y ganancias por día (30 días).
- **Telemetría:** potencia, irradiancia, temperaturas, tensiones, frecuencia, batería, 10 inversores y la curva del día.
- **Mercado:**
  - Compra a la planta o a otros usuarios (P2P), firmando la orden con la wallet.
  - Venta inmediata y publicación de ofertas.
- **Billetera:** saldo, retiros firmados a tu wallet e historial.
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
- **Continuar con Google**: necesita las credenciales (sección 4). Cada cuenta nueva recibe **5 kW de demostración con 30 días de historial** para que el panel se vea vivo. Se desactiva con `DEMO_STARTER_KW=0`.

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

La conexión de la wallet y la **firma son reales**: el servidor verifica criptográficamente que la firma corresponde a tu dirección. El **pago se simula**: ninguna firma mueve fondos.

- **En el computador:** instala la extensión de **Trust Wallet** (o MetaMask) en Chrome o Brave. Aparece sola en **Conectar wallet**.
- **Desde el celular con QR (WalletConnect):**
  1. Crea un Project ID gratis en <https://dashboard.reown.com>.
  2. Ponlo en `.env.local` como `NEXT_PUBLIC_REOWN_PROJECT_ID=...`.
  3. Vuelve a correr `npm run presentar`.
  4. En la app elige **Trust Wallet en tu celular**, escanea el código con Trust Wallet y aprueba la firma en el teléfono.
- **Wallet de demostración:** siempre está disponible. Genera una clave en el navegador que firma de verdad pero no tiene fondos. Es la opción más segura para la presentación.
- **Bitcoin por QR:** el flujo es simulado y el código **no** es una dirección real, así que no envíes fondos.

Las tasas de USDT, BNB, ETH y BTC vienen de CoinGecko. Si no hay internet, se usan precios de referencia.

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
   - `BETTER_AUTH_SECRET`: una clave larga aleatoria.
   - `BETTER_AUTH_URL`: por ejemplo `https://tu-proyecto.vercel.app`.
   - `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
   - Opcionales: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `NEXT_PUBLIC_REOWN_PROJECT_ID`.
4. Si usas Google, agrega `https://tu-proyecto.vercel.app/api/auth/callback/google` en los URI de redireccionamiento.
5. Despliega. La base de datos se crea y se siembra sola en la primera visita.

Sin Turso también funciona, pero con una base de datos temporal que se reinicia cuando Vercel reinicia el servidor.

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

| Real | Simulado |
| --- | --- |
| Login, sesiones y base de datos | La planta y su telemetría (modelo físico realista) |
| Conexión de la wallet y verificación de la firma | El movimiento de fondos y los hashes de transacción |
| Cálculo de ganancias, compras, ventas y retiros en la BD | Los inversionistas y las ofertas de ejemplo |
| Tasas cripto en vivo (CoinGecko) | El pago por QR de Bitcoin |

## 9. Próximos pasos hacia producción

1. **Conectar la planta real.** Hay que implementar una fuente de telemetría que lea el inversor (por ejemplo la API de Huawei FusionSolar, SMA o Fronius, o Modbus TCP) en lugar del modelo. Los cálculos de ganancias no cambian.
2. **Pagos reales.** Detectar transferencias de USDT en la cadena (eventos del contrato BEP-20 o ERC-20) o integrar una pasarela. Agregar PSE y tarjeta.
3. **Cumplimiento.** KYC y prevención de lavado de activos (SARLAFT). La estructura legal de la oferta a inversionistas debe validarse con asesoría legal y la Superintendencia Financiera.
4. **Operación.** Base de datos administrada, monitoreo, auditoría de seguridad y respaldos.

## 10. Solución de problemas

- **"Port 3000 is already in use":** cierra la otra app que usa el puerto o detén el servidor anterior con `Ctrl+C`.
- **`npm install` falla en un Windows con procesador ARM:** el driver local de SQLite no trae binario para ARM. Usa Turso (sección 7) definiendo `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
- **Google dice `redirect_uri_mismatch`:** el URI de redireccionamiento debe ser exactamente `http://localhost:3000/api/auth/callback/google`.
- **No aparece mi extensión de wallet:** recarga la página con la extensión desbloqueada, o usa la wallet de demostración.
- **Quiero empezar la demo de cero:** corre `npm run reset-demo` y vuelve a arrancar.
