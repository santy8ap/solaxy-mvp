# In World Energy — Eclipse frontend

## Alcance

Rediseño del frontend sobre `main` (base `10dc60a`). No se encontraron en el remoto el servidor de planes ni las migraciones mencionadas en el historial del proyecto. Esta entrega cambia la presentación y añade un catálogo consultable; no migra contratos, saldos ni pagos.

- Inicio editorial monocromático, marca In World Energy y navegación móvil.
- Cuatro planes con selector accesible, energía diaria/mensual/trimestral y pago mensual en COP.
- Utilidad bruta de referencia calculada como `(400 - precio) / precio`, con dos decimales: 14,94 %, 17,65 %, 21,21 % y 25 %. No se presenta como descuento ni como rendimiento garantizado.
- Reloj de Colombia, curva proyectada de 06:00 a 19:00 y máximo de 8.000 kW a las 12:30. La curva visual no abona energía ni dinero.
- Formularios, botones, tablas, panel, administración, gráficas y pagos con paleta gris y formas rectangulares.
- Entradas al hacer scroll, órbita decorativa, transiciones de planes y botones. Compatibilidad con movimiento reducido, foco visible, navegación por teclado y contenido legible sin animaciones.

## Estado real de la integración

El catálogo indica que la contratación mensual todavía no está habilitada. No llama a las API antiguas para cobrar un plan. El área autenticada sigue operando con el modelo previo de kW, que debe migrarse en una entrega de backend. El cambio de marca no implica verificación de una razón social ni sustituye la revisión de los términos legales.

## Validación

- Base original: 174 pruebas aprobadas.
- Con el reloj solar: 177 pruebas aprobadas (27 archivos).
- ESLint y compilación de producción de Next.js/TypeScript aprobados; 48 rutas generadas.
- Smoke test HTTP contra el servidor de producción: `/`, `/ingresar`, `/terminos` y `/privacidad` responden 200 e incluyen la nueva marca.
- Revisión visual en navegador no completada en este entorno: Chromium local no puede crear el socket requerido; el navegador remoto no alcanza localhost; la vista previa administrada añade `--host` y `--strictPort`, opciones que Next.js no admite. No se alteró el comando de desarrollo del proyecto para compensar esa incompatibilidad.

```sh
npm ci
npm run lint
npm test
npm run build
npm run dev
```

Recorrido visual pendiente en un navegador compatible: inicio a 360, 390, 768 y 1440 px; menú móvil y Escape; selección de planes con Tab/flechas; tabla con desplazamiento horizontal; preguntas frecuentes; ingreso; resumen, mercado, perfil, billetera y administración; preferencia de movimiento reducido. Verificar consola, desbordamientos, foco y contraste.

## Hallazgos que requieren una entrega posterior

1. El repositorio conserva compras de potencia, mercado P2P y perfiles individuales. No contiene contratos de energía mensuales ni validación exclusivamente empresarial.
2. La telemetría procede del simulador; la curva del nuevo inicio está explícitamente identificada como proyección. No hay evidencia de medición real ni liquidación contractual de energía.
3. `fulfillOrder` confirma la orden antes del `db.batch` que asigna la posición. Si ese lote falla, un reintento puede encontrar la orden confirmada y omitir la asignación. Revisar transacción atómica y recuperación antes de producción.
4. La comprobación de cupo y la asignación se ejecutan por separado. Añadir pruebas de compras concurrentes antes de habilitar contratos nuevos.
5. Persisten configuración y funciones demo; los términos legales están marcados como pendientes de revisión. El rediseño no certifica preparación para producción.

## Segunda entrega: panel y experiencia de planes

- Primera entrega integrada en `main`; Vercel confirmó despliegue completado y el inicio Eclipse se verificó visualmente en la URL pública.
- Nuevo panel con saldo del servidor, indicadores, gráficas, actividad y reloj solar. Navegación de escritorio y móvil centrada en resumen, planes, movimientos, billetera y cuenta.
- Nueva página pública `/planes` y catálogo autenticado `/panel/planes`. Revisión en tres pasos: valores, datos de empresa temporales y resumen. Sin llamada a pagos ni aceptación de un contrato mientras la contratación mensual no esté disponible. Los datos de esta revisión se descartan al cerrar.
- `/panel/mercado` redirige al catálogo de planes. Las API y los datos del modelo anterior permanecen sin cambios.
- Historial con búsqueda, filtros por estado y fechas de Colombia, paginación, detalle de operación y CSV. Las exportaciones neutralizan fórmulas y conservan importes registrados. El resumen no se presenta como factura.
- Ventanas nativas con aislamiento de fondo, Escape, captura de foco y restauración del foco. Carga, errores, reintento y estados vacíos explícitos.
- Exploración del reloj solar por cursor, toque o control de rango con teclado. La hora del nuevo panel usa el reloj real, independiente del modo de presentación.
- El saldo para solicitar retiros procede de la respuesta del servidor; no se incrementa mediante extrapolación del navegador. Se bloquea la acción si la carga falló o el saldo no cumple el mínimo.

Validación local tras incorporar los cambios de seguridad de `main`: ESLint sin advertencias, compilación de producción (52 rutas) y 182 pruebas aprobadas. Las pruebas nuevas cubren límites de fecha en Colombia, combinación de filtros y neutralización de fórmulas en CSV. Recorrido HTTP de inicio, catálogo, selección por URL e ingreso aprobado; el portafolio sin sesión devuelve 401.
