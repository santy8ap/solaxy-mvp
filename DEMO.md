# Guion de la demo para los socios (6 a 8 minutos)

## Antes de la reunión

- [ ] 15 minutos antes, en la carpeta del proyecto: `npm run presentar` y abre <http://localhost:3000> en Chrome.
- [ ] Ten abierta una pestaña con la landing y otra con el panel (cuenta demo o tu Google).
- [ ] Si vas a pagar con Trust Wallet desde el celular: configura `NEXT_PUBLIC_REOWN_PROJECT_ID` (ver README) y ten el celular con internet. Si no, usa la **wallet de demostración**: firma de verdad y no depende de nada.
- [ ] Prueba la tecla **P** (Modo presentación) y vuelve a **Hora real**.
- [ ] Portátil cargado y en modo "no molestar".
- [ ] A las 7 p. m. ya no hay sol. Es normal: la planta está entregando la energía de la **batería** en la hora pico, y lo vas a mostrar como una ventaja.

## 1. La idea en una frase (30 s), en la landing

> "Solaxy convierte la energía del sol en una inversión que cualquiera puede comprar desde su wallet, desde 0,1 kW. Y lo que ganas lo ves crecer en vivo."

- Señala el **arco del sol**: es la posición real del sol sobre la planta en este momento.
- Si es de noche: "El sol se ocultó, pero la planta sigue vendiendo la energía que guardó en la batería, y a mejor tarifa."
- Baja al **mapa de celdas**: "Cada celda son 20 kW. Las doradas ya tienen dueño."

## 2. ¿Cuánto ganaría? (45 s), en el simulador

- Mueve el control a **10 kW**: inversión, ganancia mensual, anual y en cuánto se recupera.
- Aclara que es una estimación con la producción de la planta, no una tasa fija.

## 3. Ingresar (20 s)

- **Empezar a invertir → Continuar con Google**, o **Entrar con la cuenta demo**.

## 4. El panel (1 min 30 s)

- **Ganancias acumuladas**: "Miren los centavos: esto sube cada segundo según la energía que se está vendiendo ahora."
- **Del sol a tu billetera**: el recorrido de la energía con valores en vivo. De noche se ilumina la batería.
- **Gráficas**: cómo crece la inversión y lo que gana cada día ("los días nublados gana menos, es energía real").

## 5. Telemetría (1 min)

- Potencia, irradiancia, temperatura de los módulos, tensión, frecuencia de 60 Hz y los **10 inversores**.
- Selector **Tu parte**: los mismos datos, pero solo la porción que es del usuario.
- Tecla **P → Mediodía** y velocidad **×60**: "Así se ve un día completo en un minuto." Muestra cómo suben la curva y las ganancias.
- Vuelve a **Hora real**.

## 6. Comprar en vivo (1 min 30 s): el momento fuerte

1. **Mercado → paquete Sol (2 kW) → USDT en BNB Smart Chain**.
2. **Conectar wallet**:
   - **Trust Wallet en tu celular**: escanea el QR y aprueba la firma en el teléfono.
   - O la **wallet de demostración**.
3. Sigue los pasos en pantalla: orden creada, firma verificada, pago enviado, confirmaciones 1/3 a 3/3 y **energía asignada**.
4. **Ver mis ganancias**: los kW subieron y el ritmo por hora también.

> "En esta presentación el pago es simulado: la firma es real y el servidor verifica criptográficamente que la wallet es tuya, pero no se mueve dinero. En producción, el mismo botón cobra de verdad con Mercado Pago (tarjeta, PSE o Nequi) o con USDT y BNB directo a la billetera de la empresa, verificado en la cadena."

## 7. Liquidez (30 s)

- **Mercado → Vender**: venta inmediata al 97 % o publicar una oferta a tu precio.
- **Billetera → Retirar a mi wallet**: se firma el retiro y queda en el historial.

## 8. El negocio (1 min), en la vista de socios

- Capital levantado, porcentaje de la planta vendido, inversionistas y energía entregada.
- **Ingresos**: cuánto se repartió a los inversionistas (82 %) y cuánto queda para operación y la plataforma (18 %).

## 9. Cierre (30 s)

> "Lo que vieron funciona de punta a punta: login, base de datos, wallets y pagos reales listos para activarse con las llaves de producción. Los siguientes pasos son conectar el inversor de la planta real y cerrar la parte regulatoria."

---

## Preguntas probables

**¿Los datos son reales?**
La planta y su telemetría vienen de un modelo físico: la posición del sol, las nubes, la temperatura y la batería. Para conectar una planta real solo hay que cambiar la fuente de datos por la API del inversor (Huawei, SMA, Fronius o Modbus). El resto del sistema no cambia.

**¿De dónde sale la rentabilidad?**
De vender la energía: kWh entregados × tarifa (560 $/kWh de día y 820 $/kWh en la hora pico con la batería), menos el 18 % de operación y plataforma. Con el precio de 4,8 millones por kW da cerca de 15–16 % efectivo anual estimado. Todo se ajusta en `src/config/economics.ts`.

**¿Cómo gana dinero Solaxy?**
Con el 18 % del ingreso por energía (configurable) y el 3 % de diferencia en la venta inmediata. En el futuro puede haber una comisión en el mercado P2P.

**¿Por qué cripto?**
Las stablecoins como USDT permiten pagos rápidos y de bajo costo, incluso desde el exterior. Además, la plataforma ya cobra con tarjeta, PSE y Nequi a través de Mercado Pago, y con USDT o BNB directo a la billetera de la empresa (verificado en la cadena). Para la presentación se usa el modo demo, con pagos simulados.

**¿Es legal?**
El MVP no capta dinero. Antes de abrirlo al público hay que definir la estructura legal (KYC, SARLAFT y el marco de la Superintendencia Financiera) con asesoría especializada.

**¿Qué pasa de noche o si llueve?**
De noche la batería vende en la hora pico. Si está nublado se produce menos y por eso la rentabilidad es estimada, no garantizada. Se ve en la gráfica de ganancias diarias.
