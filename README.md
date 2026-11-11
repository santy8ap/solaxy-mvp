# X green Energy

Plataforma de paquetes de energía para comercializadores. El front usa el sistema monocromático Eclipse y el mensaje **«Bienvenido al mundo de la energía»**. Conserva el reloj solar de 6 a. m. a 7 p. m., con máximo de 8.000 kW.

La generación que muestra la aplicación se calcula con una curva solar; no es telemetría de inversores. Un pago confirmado activa un período de 30 días. El contrato tiene tres mensualidades. Las condiciones de compra y venta se guardan en cada paquete: modificar el catálogo no cambia contratos existentes.

## Desarrollo

Se requiere Node.js 20.9 o superior y npm.

```bash
npm ci
npm run setup
npm run dev
```

Abre <http://localhost:3000>. `setup` crea `.env.local` si falta y genera las claves locales. La base local se crea en `data/iwe.db`; no se inventan planes, clientes ni movimientos. La cuenta de pruebas se crea al usar ese ingreso con `DEMO_MODE=true`.

```bash
npm run lint
npm test
npm run build
npm start
```

## Recorrido del cliente

- Elegir un paquete abre `/comprar?plan=p180` (o el identificador seleccionado). Si falta sesión, `/ingresar` conserva el destino mediante `next`, limitado a rutas internas permitidas.
- La compra tiene cuatro pasos: datos personales, resumen, medio de pago y confirmación. Solicita nombre, documento, celular, ciudad y aceptación de los términos vigentes; no requiere razón social ni NIT.
- El resumen muestra compra por kWh, venta contratada, utilidad bruta y mensualidad en COP. Los porcentajes de la tabla con `≈` están redondeados; el detalle muestra dos decimales. Por ejemplo, `(400 − 348) / 348 × 100 = 14,94 %`, aproximadamente 15 %.
- Los medios disponibles dependen de la configuración real: Mercado Pago, USDT/BNB o pago de prueba. Los importes se calculan en el servidor. Si los precios revisados cambian antes de crear la orden, se requiere actualizar el resumen.
- Los movimientos confirmados tienen comprobante PDF privado con titular, documento, paquete, precios, fecha y referencia. Es informativo, no una factura fiscal. Las operaciones de prueba quedan identificadas y las devueltas no emiten comprobante de pago vigente.
- La billetera tiene filtros, paginación y exportación CSV de todo el historial coincidente. Los rendimientos pueden consultarse y exportarse por períodos de 7, 30 o 90 días.
- `/panel/avisos` muestra confirmaciones, mensualidades próximas, retiros y casos que requieren atención. Son avisos dentro de la aplicación; no se envían correos ni mensajes automáticamente.
- `/ayuda` es pública. El contacto oficial se guarda desde **Admin → Planta** o con `SUPPORT_EMAIL` / `SUPPORT_WHATSAPP`. No se publica un contacto ficticio si faltan esos datos.
- `/planes`, `/planta` y las rutas anteriores del panel redirigen a sus vistas actuales.

## Pagos y devoluciones

La confirmación de una orden, la inserción del período y el inicio del paquete se guardan en una transacción. Un fallo revierte los tres cambios y permite reintentar. Los índices únicos impiden acreditar dos veces un mes o un pago. Los pagos reales que llegan sin cupo o para un mes ya pagado quedan por reembolsar.

Los webhooks de Mercado Pago consultan el pago en la API del proveedor antes de aplicarlo. Una devolución o contracargo verificado cambia el movimiento a `reembolsada` y registra una revisión auditable. Solo el período afectado deja de generar desde la detección; se conservan el historial y las fechas de los demás meses pagados. No se descuentan automáticamente rendimientos ya acumulados ni se envían reembolsos desde esta aplicación.

Mientras exista una devolución pendiente de conciliación, se bloquean nuevos retiros, su aprobación y las renovaciones del paquete afectado. En **Admin → Pagos → Registrar conciliación**, el equipo debe registrar el acuerdo y su referencia después de revisar el saldo y los retiros con el titular. Esta acción levanta el bloqueo, conserva el corte del período devuelto y no mueve dinero. Las demás mensualidades deben resolverse según el acuerdo comercial.

Los retiros son manuales: el administrador verifica al titular, realiza el envío y registra su referencia. Los datos bancarios completos solo se muestran al administrador autorizado.

## Verificación cripto en segundo plano

`GET /api/cron/payments` procesa órdenes cripto con hash y estado `verificando`. Requiere `Authorization: Bearer CRON_SECRET`, con una clave aleatoria de al menos 32 caracteres. Sin esa configuración rechaza la solicitud. Un arrendamiento en la base evita ejecuciones superpuestas y un cursor durable evita que un error deje siempre bloqueada la primera orden. Cada lote tiene un presupuesto de tiempo y de operaciones.

`vercel.json` incluye una ejecución diaria a las 10:00 UTC como recuperación independiente de las visitas. La consulta inmediata y el seguimiento del pago siguen funcionando. Para operación comercial, configura y supervisa una frecuencia adecuada: Vercel Pro permite cron por minuto; Hobby limita el cron a una vez al día. También puede usarse un programador externo autenticado contra la misma ruta. No se ha contratado ningún servicio adicional ni configurado claves de producción desde el repositorio.

Referencias: [seguridad y funcionamiento de cron](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs), [frecuencias por plan](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

## Configuración y despliegue

Consulta [.env.example](.env.example) y **Admin → Pagos → Para cobrar de verdad**. Nunca subas `.env.local`, claves privadas de wallets ni tokens al repositorio.

| Configuración | Propósito |
| --- | --- |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sesiones y URL pública |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ingreso de cuentas reales |
| `ADMIN_PIN`, `ADMIN_EMAILS` | Acceso administrativo |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Persistencia en Vercel |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Checkout y notificaciones firmadas |
| `CRYPTO_TREASURY_ADDRESS`, `CRYPTO_NETWORK`, `CRYPTO_CONFIRMATIONS` | Destino público y verificación de pagos cripto |
| `BSC_RPC_URL`, `USDT_CONTRACT`, `COINGECKO_API_KEY` | Ajustes opcionales de red y precios |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Conexión de wallet por QR |
| `CRON_SECRET` | Autenticación de verificaciones programadas |
| `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP` | Contactos oficiales; también se guardan desde el admin |
| `DEMO_MODE` | `true`: pruebas; `false`: pagos reales y sin cuenta de pruebas |

El webhook de Mercado Pago debe apuntar a `https://tu-dominio/api/webhooks/mercadopago`, con el evento Pagos. Google usa `https://tu-dominio/api/auth/callback/google` como URI de redirección.

Vercel despliega al actualizar `main`. Las migraciones se aplican al iniciar el servicio; las nuevas tablas de soporte, conciliación y trabajos son aditivas. Una vista previa con migraciones pendientes se bloquea para no cambiar la base de producción. `ALLOW_PREVIEW_MIGRATIONS=true` solo corresponde a un entorno Preview con base aislada.

Publicar el código no activa cobros reales. Faltan los datos y la revisión del responsable en `src/config/legal.ts`, el contacto oficial, las credenciales reales y la configuración operativa. La lista del admin mantiene esos pendientes visibles y no considera lista la operación mientras permanezca en modo de pruebas o falte la revisión legal.

## Pruebas automáticas

`npm test` cubre contratos, curva y rendimientos, importes, propiedad de comprobantes e historial, concurrencia de pagos/retiros, fallos transaccionales, devoluciones, conciliación, autenticación y trabajos programados. Los proveedores se sustituyen por adaptadores controlados en estas pruebas; no se realizan transacciones reales.

Para los recorridos de navegador:

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright inicia un servidor en `127.0.0.1:4173` y una base nueva bajo el directorio temporal. Deshabilita las pasarelas externas y utiliza únicamente la cuenta y el pago de pruebas. Recorre escritorio y móvil, incluidos el formulario personal, resumen, confirmación, PDF, CSV, avisos, enlaces antiguos y acceso privado. No reutiliza `data/iwe.db`, Turso ni el sitio publicado. GitHub Actions ejecuta lint, pruebas unitarias, compilación y estos recorridos; conserva trazas de fallos durante siete días.

Los documentos de `docs/superpowers/` describen decisiones históricas; este README explica el funcionamiento actual.
