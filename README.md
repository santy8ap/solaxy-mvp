# X green Energy

Plataforma de planes de energía para comercializadores. El front usa el sistema monocromático Eclipse y el mensaje **«Bienvenido al mundo de la energía»**. Conserva el reloj solar de 6 a. m. a 7 p. m., con máximo de 8.000 kW.

La generación que muestra la aplicación se calcula con una curva solar; no es telemetría de inversores. Un pago confirmado activa un período de 30 días. El contrato tiene tres mensualidades. Las condiciones de compra y venta se guardan en cada plan: modificar el catálogo no cambia contratos existentes.

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

- Elegir un plan abre `/comprar?plan=p180` (o el identificador seleccionado). Si falta sesión, `/ingresar` conserva el destino mediante `next`, limitado a rutas internas permitidas.
- La compra tiene cuatro pasos: datos personales, resumen, medio de pago y confirmación. Solicita nombre, documento, celular, ciudad y aceptación de los términos vigentes; no requiere razón social ni NIT.
- El resumen muestra compra por kWh, venta contratada, utilidad bruta y mensualidad en COP. Los porcentajes de la tabla con `≈` están redondeados; el detalle muestra dos decimales. Por ejemplo, `(400 − 348) / 348 × 100 = 14,94 %`, aproximadamente 15 %.
- Los medios disponibles dependen de la configuración real: Mercado Pago, transferencia bancaria, USDT/BNB o pago de prueba. Los importes se calculan en el servidor y los medios de Mercado Pago respetan los topes reportados por la pasarela. Si los precios revisados cambian antes de crear la orden, se requiere actualizar el resumen.
- Los movimientos confirmados tienen comprobante PDF privado con titular, documento, plan, precios, fecha y referencia. Es informativo, no una factura fiscal. Las operaciones de prueba quedan identificadas y las devueltas no emiten comprobante de pago vigente.
- La billetera tiene filtros, paginación y exportación CSV de todo el historial coincidente. Los rendimientos pueden consultarse y exportarse por períodos de 7, 30 o 90 días.
- `/panel/avisos` muestra confirmaciones, mensualidades próximas, retiros y casos que requieren atención. Son avisos dentro de la aplicación; no se envían correos ni mensajes automáticamente.
- Un plan terminado o cerrado ofrece «Renovar» (la compra del mismo plan con los precios vigentes), y los avisos lo recuerdan cuando termina.
- En `/panel/perfil`, cada comercializador puede descargar sus datos (JSON) y pedir que se elimine su cuenta (Ley 1581). El admin la atiende en **Clientes** dentro de 15 días hábiles: eliminar quita el acceso, el correo, el celular, la ciudad y la wallet; si hubo pagos, se conservan el nombre, el documento y los movimientos que la ley contable obliga a guardar. Una cuenta eliminada deja de entrar de inmediato.

## Administración

`/admin` exige una cuenta de `ADMIN_EMAILS` y el `ADMIN_PIN` (5 intentos por minuto). Secciones:

- **Resumen**: lo que hay que atender (transferencias por confirmar, retiros por pagar, pagos por devolver, devoluciones por conciliar, planes en pausa y mensualidades que vencen esta semana), el cupo de la planta y los totales.
- **Análisis**: recaudo por mes y por medio de pago, embudo de clientes, mensualidades que vienen y cupo, con tabla de datos. Las visitas y la velocidad de la página se ven en Vercel (Web Analytics y Speed Insights), que no miden el admin ni envían los parámetros de las direcciones.
- **Clientes**: búsqueda, grupos (generando, en pausa, transferencia por confirmar, solicitudes de eliminación de datos, sin pagar, sin datos), registro de pagos a mano, cierre de planes, atención de solicitudes sobre datos personales y exportación CSV.
- **Pagos**: filtros por estado y medio, búsqueda por cliente, NIT, orden o referencia, acciones de verificación, transferencias y reembolsos, y exportación CSV para la contabilidad.
- **Retiros**, **Planta** (potencia y precios), **Configuración** (lista para cobrar dinero real, cuenta para transferencias, soporte y alertas por correo) y **Actividad** (bitácora con filtros).
- `/ayuda` es pública. El contacto oficial se guarda desde **Admin → Configuración** o con `SUPPORT_EMAIL` / `SUPPORT_WHATSAPP`. No se publica un contacto ficticio si faltan esos datos.
- `/planes`, `/planta` y las rutas anteriores del panel redirigen a sus vistas actuales.

## Pagos y devoluciones

La confirmación de una orden, la inserción del período y el inicio del plan se guardan en una transacción. Un fallo revierte los tres cambios y permite reintentar. Los índices únicos impiden acreditar dos veces un mes o un pago. Los pagos reales que llegan sin cupo o para un mes ya pagado quedan por reembolsar.

Los webhooks de Mercado Pago consultan el pago en la API del proveedor antes de aplicarlo. Una devolución o contracargo verificado cambia el movimiento a `reembolsada` y registra una revisión auditable. Solo el período afectado deja de generar desde la detección; se conservan el historial y las fechas de los demás meses pagados. No se descuentan automáticamente rendimientos ya acumulados ni se envían reembolsos desde esta aplicación.

Mientras exista una devolución pendiente de conciliación, se bloquean nuevos retiros, su aprobación y las renovaciones del plan afectado. En **Admin → Pagos → Registrar conciliación**, el equipo debe registrar el acuerdo y su referencia después de revisar el saldo y los retiros con el titular. Esta acción levanta el bloqueo, conserva el corte del período devuelto y no mueve dinero. Las demás mensualidades deben resolverse según el acuerdo comercial.

Los retiros son manuales: el administrador verifica al titular, realiza el envío y registra su referencia. Los datos bancarios completos solo se muestran al administrador autorizado.

## Tareas en segundo plano

`GET /api/cron/payments` hace la pasada diaria. Requiere `Authorization: Bearer CRON_SECRET`, con una clave aleatoria de al menos 32 caracteres; sin esa configuración rechaza la solicitud. Hace tres cosas:

- **Pagos cripto**: verifica en la cadena las órdenes con hash y estado `verificando`. Un arrendamiento en la base evita ejecuciones superpuestas.
- **Mercado Pago**: consulta las órdenes cuyo aviso pudo perderse. Las que nadie ha pagado, durante 2 días; las que Mercado Pago tiene en proceso (por ejemplo, un PSE), hasta 30 días; y los pagos confirmados de los últimos 180 días, para detectar devoluciones.
- **Mantenimiento**: cierra como canceladas las órdenes que nadie pagó (Mercado Pago a los 2 días, una cotización cripto un día después de vencer, un retiro a wallet sin firmar al día) y borra las sesiones vencidas. Cerrar no pierde dinero: si el pago llega después, la orden se reabre y se activa (o queda por reembolsar), y a una cotización cripto cancelada todavía se le puede registrar el hash.

Cada tarea recorre las órdenes por tandas con un cursor guardado en la base: con más órdenes de las que caben en una pasada, las revisa todas por turnos y un error no deja bloqueada siempre la primera. Cada pasada tiene un presupuesto de tiempo.

Además del cron, las mismas tareas corren con las visitas (después de responder, sin demorar a nadie): los pagos como máximo cada 2 minutos y el mantenimiento como máximo una vez por hora en todo el sitio.

`vercel.json` incluye una ejecución diaria a las 10:00 UTC como recuperación independiente de las visitas. La consulta inmediata y el seguimiento del pago siguen funcionando. Para operación comercial, configura y supervisa una frecuencia adecuada: Vercel Pro permite cron por minuto; Hobby limita el cron a una vez al día. También puede usarse un programador externo autenticado contra la misma ruta. No se ha contratado ningún servicio adicional ni configurado claves de producción desde el repositorio.

Referencias: [seguridad y funcionamiento de cron](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs), [frecuencias por plan](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

## Configuración y despliegue

Consulta [.env.example](.env.example) y **Admin → Configuración → Para cobrar de verdad**. Nunca subas `.env.local`, claves privadas de wallets ni tokens al repositorio.

| Configuración | Propósito |
| --- | --- |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sesiones y URL pública |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ingreso de cuentas reales |
| `ADMIN_PIN`, `ADMIN_EMAILS` | Acceso administrativo |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Persistencia en Vercel |
| `PREVIEW_TURSO_DATABASE_URL`, `PREVIEW_TURSO_AUTH_TOKEN` | Base propia de las vistas previas (Preview), separada de producción |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Checkout y notificaciones firmadas |
| `CRYPTO_TREASURY_ADDRESS`, `CRYPTO_NETWORK`, `CRYPTO_CONFIRMATIONS` | Destino público y verificación de pagos cripto |
| `BSC_RPC_URL`, `USDT_CONTRACT`, `COINGECKO_API_KEY` | Ajustes opcionales de red y precios |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Conexión de wallet por QR |
| `CRON_SECRET` | Autenticación de verificaciones programadas |
| `RESEND_API_KEY`, `ALERT_EMAIL`, `ALERT_FROM` | Alertas por correo al administrador (pagos, transferencias, retiros, devoluciones y fallas) |
| `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP` | Contactos oficiales; también se guardan desde el admin |
| `DEMO_MODE` | `true`: pruebas; `false`: pagos reales y sin cuenta de pruebas |

El webhook de Mercado Pago debe apuntar a `https://tu-dominio/api/webhooks/mercadopago`, con el evento Pagos. Google usa `https://tu-dominio/api/auth/callback/google` como URI de redirección.

Vercel despliega al actualizar `main`. Las migraciones se aplican al iniciar el servicio; las nuevas tablas de soporte, conciliación y trabajos son aditivas. Las vistas previas nunca usan la base de producción: se conectan a la suya (`PREVIEW_TURSO_DATABASE_URL`) y allí aplican sus migraciones; sin ella usan un archivo temporal. `ALLOW_PREVIEW_MIGRATIONS=true` solo corresponde a una vista previa con otra base remota aislada.

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
