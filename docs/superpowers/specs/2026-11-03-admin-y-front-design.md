# Diseño: modo administrador y mejoras de front en Solaxy

**Fecha:** 3 de noviembre de 2026. **Para:** la reunión con los socios del 4 de noviembre.

## Objetivo

Al iniciar sesión, cada persona elige entrar como **Inversionista** o como **Administrador**. El administrador controla el negocio:
- asigna y quita kW a los usuarios,
- configura la planta,
- aprueba compras y retiros.

Además se sube el nivel visual de la landing y del panel, con más animaciones "wow".

## Decisiones confirmadas

- **Acceso admin:** con un PIN.
- **El admin puede:** asignar y quitar kW, configurar la planta y aprobar **retiros**. **Las compras se confirman al instante**, como ahora; así lo pidió el usuario al aprobar el diseño. Varias plantas queda fuera de este alcance.
- **Front:** landing más impactante, panel más pulido y más animaciones.
- **Vercel:** se conecta una base de datos Turso para que los cambios del admin se guarden.

## Enfoque elegido

| Tema | Elegido | Descartado y por qué |
| --- | --- | --- |
| Rol | Se elige **en cada inicio de sesión**. Una cookie firmada (HMAC) queda atada a esa sesión y vence en 12 h | Rol fijo por usuario (plugin admin de Better Auth): no permite "elegir cada vez" |
| Configuración de la planta | **En la base de datos**. `src/config` queda como valores iniciales | Variables de entorno: el admin no podría cambiarlas desde la web |
| Aprobaciones | **Solo retiros**: estado `por_aprobar`, cola del admin e interruptor para exigir o no aprobación | Aprobar también compras: el usuario lo descartó para conservar la compra instantánea |

## 1. Roles y acceso

- **Ingreso:** arriba hay un selector **"Entrar como: Inversionista / Administrador"**. Si eliges Administrador aparece el campo **PIN**.
- **Cuenta demo:** valida el PIN, inicia sesión, guarda la cookie de admin y lleva a `/admin`. Todo en un solo paso.
- **Google:**
  1. El PIN se valida **antes** de salir hacia Google y queda una cookie de "intención" que dura 10 min.
  2. Google regresa a `/api/admin/activar`, que la convierte en la cookie de admin y redirige a `/admin`.
- **La cookie `solaxy-admin`** es `userId.sessionId.vencimiento.firma`. Si es de otra sesión, está vencida o fue alterada, no sirve. Al salir se borra.
- **PIN:** se toma de la variable `ADMIN_PIN`. En local el valor por defecto es `2026`; en Vercel configuro uno aleatorio. Se admiten 5 intentos por cada 10 min.
- **Cambiar de rol:** en el panel hay un "Entrar como administrador" (pide el PIN) y en el admin un "Ver como inversionista".
- **Seguridad:** todas las rutas `/api/admin/*` verifican `requireAdmin()`.

## 2. Panel de administración (`/admin`)

Tiene su propia barra lateral: Resumen, Usuarios, Aprobaciones (con contador), Planta y Actividad.

- **Resumen:**
  - Indicadores del negocio.
  - Pendientes por aprobar.
  - Últimos cambios.
- **Usuarios:**
  - Tabla con búsqueda y filtro de cuentas reales o de la comunidad. Muestra kW, invertido, ganancias, saldo y el último movimiento de cada uno.
  - **Ajustar kW** permite fijar un total nuevo o sumar/restar.
  - Se elige **desde cuándo** cuenta: hoy, hace 7, 30 o 90 días. Así las ganancias aparecen de inmediato con su historia.
  - Pide un motivo.
  - El ajuste crea el movimiento `ajuste_admin`, visible en la billetera del usuario. No permite pasarse de la capacidad disponible.
- **Aprobaciones (solo retiros):**
  - Los retiros llegan con la firma ya verificada.
  - Botones **Aprobar** y **Rechazar** (con motivo).
  - Interruptor **"Requerir aprobación de retiros"**, activado por defecto.
  - Lo que ve el usuario: después de firmar aparece "Esperando aprobación del administrador", que se actualiza solo. Si se aprueba, el retiro queda enviado; si se rechaza, se muestra el motivo y el saldo vuelve a estar disponible.
  - Mientras el retiro espera, **aparta saldo**.
  - Las compras (planta y P2P) se confirman al instante, como ahora.
- **Planta:**
  - Se editan nombre, ubicación, capacidad (kWp), precio por kW, tarifa de día, tarifa pico y comisión (%).
  - Los cambios aplican **de ahora en adelante**: el historial no cambia.
  - La capacidad no puede quedar por debajo de los kW ya vendidos.
- **Actividad:** bitácora de todo lo que hizo el admin (quién, qué, antes y después, cuándo).

## 3. Cambios de arquitectura

- **Migración `0001`:**
  - Columnas nuevas en `plant`: tarifas, comisión y el interruptor de aprobación de retiros.
  - Columna `note` en `ledger_tx` para el motivo de un ajuste o de un rechazo.
  - Tabla nueva `admin_audit`.
- **Configuración dinámica:**
  - En el servidor, `getSettings()` con caché de 5 s.
  - En el navegador, `/api/settings` y el hook `useSettings()`.
  - El motor (`src/lib/sim`) ya recibe `spec` y `econ` como parámetros; solo hay que pasarle la configuración de la BD. La clave de la caché de perfiles incluirá la capacidad.
- **Estados nuevos:**
  - Transacciones: `por_aprobar` y `rechazada` (solo para retiros).
  - Tipo de movimiento: `ajuste_admin`.
- **SSE:** el stream se cierra solo a los 4 minutos y el navegador se reconecta. Así desaparece el error de timeout de 300 s que registra Vercel.

## 4. Front

- **Landing más impactante:**
  - **Hero cinematográfico.** El cielo cambia con la hora real: amanecer, día, atardecer y noche con estrellas. Al fondo hay capas de cordillera antioqueña y, delante, un campo solar en perspectiva con filas que se pierden en el horizonte y destellos. El sol sigue su arco real y el titular va sobre el cielo.
  - **"Cómo funciona" como recorrido de la energía**: sol → panel → batería → tu billetera, que avanza al hacer scroll.
  - **Franja en vivo** con las compras recientes de la comunidad.
- **Panel más pulido:**
  - Más jerarquía y estados de carga consistentes.
  - Microinteracciones y gráficas con entrada animada.
  - Estados vacíos que invitan a actuar.
- **Animaciones "wow":**
  - Transiciones de página con `<ViewTransition>` de React 19.3: deslizamiento y fundido.
  - **Partículas de energía** brillantes en el flujo, en vez de guiones.
  - **Celebración de compra:** un destello solar y el contador de kW subiendo.
  - Todo respeta "reducir movimiento".

## 5. Pruebas

- **TDD (vitest):**
  - La cookie de admin: firma, vencimiento y que sea de otra sesión.
  - El PIN y su límite de intentos.
  - El ajuste de kW: capacidad e historial.
  - La aprobación y el rechazo de retiros, con el saldo apartado y luego liberado.
  - La configuración: las tarifas nuevas aplican solo hacia adelante.
  - Que `requireAdmin` rechace.
- **Playwright de punta a punta:**
  1. El usuario compra y la compra se confirma al instante.
  2. El usuario pide un retiro, el admin lo aprueba y el usuario lo ve enviado.
  3. El admin ajusta kW y cambia el precio, y el mercado refleja el cambio.
  4. Capturas en escritorio y celular.

## 6. Vercel

- **Tú:** Vercel → proyecto `solaxy-mvp` → **Storage → Turso → conectar** (unos 5 min). Esto crea `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
- **Yo:**
  1. Configuro `BETTER_AUTH_SECRET` y `ADMIN_PIN`.
  2. Redespliego y verifico.

## 7. Orden de implementación (por capas)

1. Tipos y esquema (migración `0001`).
2. Configuración dinámica en el servidor y el navegador.
3. Acceso admin: PIN, cookie y `requireAdmin`.
4. Aprobación de retiros: estados, saldo apartado y espera en la interfaz.
5. Ajuste de kW y bitácora.
6. Interfaz del admin.
7. Front: hero cinematográfico y narrativa de la landing.
8. Front: panel pulido, view transitions, partículas y celebración.
9. Verificación (pruebas y Playwright) y despliegue en Vercel.

## Fuera de alcance

- Varias plantas.
- Roles permanentes por usuario.
- Pagos on-chain reales.
