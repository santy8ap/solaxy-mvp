import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { PLAN_MONTHS } from "@/config/plans";
import { SOLAR } from "@/config/solar";
import { DAYS_PER_MONTH, GRACE_DAYS } from "@/lib/energy/plan-math";
import { formatCop, formatHourLabel } from "@/lib/format";
import { MIN_WITHDRAWAL_COP } from "@/lib/withdrawal-schema";
import { LegalPage, Ph, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Términos y Condiciones" };

const SECTIONS: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    body: (
      <p>
        La plataforma {BRAND.name} es operada por {LEGAL.company}, sociedad identificada con NIT <Ph>{LEGAL.nit}</Ph>, con domicilio en <Ph>{LEGAL.address}</Ph>, <Ph>{LEGAL.city}</Ph>. Puedes
        contactarnos en <Ph>{LEGAL.email}</Ph> o al <Ph>{LEGAL.phone}</Ph>.
      </p>
    ),
  },
  {
    id: "quien-puede",
    title: "Quién puede usar la plataforma",
    body: (
      <ul>
        <li>
          <strong>Solo empresas.</strong> Los planes se venden a personas jurídicas constituidas en Colombia. No vendemos planes a personas naturales.
        </li>
        <li>
          Quien registra la empresa declara que es su representante legal o que está autorizado para obligarla, y que los datos que entrega (razón social, NIT y representante legal) son verdaderos y
          están actualizados. Cada empresa tiene una sola cuenta.
        </li>
        <li>Se ingresa con una cuenta de Google. La empresa responde por la seguridad de esa cuenta y por lo que se haga desde ella.</li>
        <li>
          Para cumplir las normas de prevención de lavado de activos y financiación del terrorismo, podemos pedir documentos (por ejemplo, el certificado de existencia y representación legal y el
          RUT), verificar la información y suspender o rechazar operaciones cuando haya alertas.
        </li>
      </ul>
    ),
  },
  {
    id: "plan",
    title: "Qué es un plan de energía",
    body: (
      <>
        <p>
          Un plan es la compra de una cantidad fija de energía solar, medida en kilovatios hora (kWh), que la planta genera para tu empresa durante {PLAN_MONTHS} meses de {DAYS_PER_MONTH} días.
        </p>
        <ul>
          <li>La energía de cada mes pagado se reparte en partes iguales entre sus {DAYS_PER_MONTH} días.</li>
          <li>
            Dentro de cada día sigue la curva de generación de la planta, el reloj solar: empieza a las {formatHourLabel(SOLAR.startHour)}, llega a su máximo a la mitad del día solar y termina a las{" "}
            {formatHourLabel(SOLAR.endHour)}, hora de Colombia. De noche no se genera.
          </li>
          <li>
            <strong>Las cifras de energía de tu panel se calculan con esa curva.</strong> No son la lectura en vivo de un medidor.
          </li>
        </ul>
        <p>
          La figura jurídica del plan es <Ph>[definir con el asesor legal: por ejemplo, compraventa de energía con mandato de comercialización, o cuentas en participación]</Ph>. Comprar un plan no
          convierte a tu empresa en accionista de {LEGAL.company} ni en propietaria de equipos de la planta.
        </p>
      </>
    ),
  },
  {
    id: "precios",
    title: "Precios y utilidad",
    body: (
      <>
        <ul>
          <li>Cada plan tiene un precio por kWh, publicado en la tabla de planes. La energía de todos los planes se vende al precio de venta publicado en esa misma tabla.</li>
          <li>La utilidad es la diferencia entre el precio de venta y el precio de tu plan. La tabla la muestra como porcentaje sobre el precio del plan.</li>
          <li>El precio de tu plan y el precio de venta quedan fijos desde la compra y durante todo el plan, aunque después cambien los precios publicados.</li>
        </ul>
        <p>
          <Ph>
            [El asesor legal debe definir si la venta de la energía al precio publicado es una obligación de {LEGAL.company} o si depende de la generación real de la planta y de las condiciones del
            mercado, y redactar esta cláusula en consecuencia.]
          </Ph>
        </p>
      </>
    ),
  },
  {
    id: "pagos",
    title: "Pagos",
    body: (
      <>
        <p>
          Un plan se paga mes a mes y por adelantado. Cada pago confirmado activa {DAYS_PER_MONTH} días de energía, que cuentan desde la confirmación. Si pagas el mes siguiente antes de que termine
          el actual, sus {DAYS_PER_MONTH} días empiezan cuando termina el mes en curso.
        </p>
        <ul>
          <li>
            <strong>Tarjeta, PSE y Nequi:</strong> se procesan a través de Mercado Pago, que aplica sus propios términos y sus propios límites por transacción. {BRAND.name} no recibe ni guarda los
            datos de tu tarjeta.
          </li>
          <li>
            <strong>Cripto (USDT o BNB en BNB Smart Chain):</strong> la cotización dura 20 minutos. Debes enviar al menos el monto exacto, desde la wallet conectada, a la dirección que muestra la
            plataforma y en la red BNB Smart Chain. Las transacciones en blockchain son irreversibles: un envío por otra red, a otra dirección o por un monto menor puede perderse o requerir una
            gestión manual que no podemos garantizar.
          </li>
          <li>
            <strong>Transferencia bancaria:</strong> se coordina con nuestro equipo, que registra el pago con el número del comprobante.
          </li>
        </ul>
        <p>
          Los planes dependen del cupo de energía de la planta. Si un pago se confirma cuando ya no hay cupo, o cuando ese mes ya estaba pagado, te devolvemos el dinero por el mismo medio cuando
          sea posible, en un plazo de <Ph>[número]</Ph> días hábiles.
        </p>
      </>
    ),
  },
  {
    id: "mora",
    title: "Si no pagas un mes",
    body: (
      <ul>
        <li>Si al terminar un mes pagado no has pagado el siguiente, el plan queda en pausa: deja de generar energía y no se cobra nada.</li>
        <li>
          Tienes {GRACE_DAYS} días para pagar. Al hacerlo, el plan retoma por {DAYS_PER_MONTH} días desde la confirmación del pago.
        </li>
        <li>Pasados los {GRACE_DAYS} días, el plan se cierra y libera su cupo. La energía que ya generó y su venta se conservan en tu saldo.</li>
        <li>Los meses que no se pagan no se generan ni se cobran.</li>
      </ul>
    ),
  },
  {
    id: "saldo",
    title: "Saldo y retiros",
    body: (
      <>
        <p>Cada kWh que generan tus planes se abona a tu saldo al precio de venta de tu plan. Tu saldo es esa venta acumulada menos tus retiros.</p>
        <ul>
          <li>
            Puedes pedir un retiro desde {formatCop(MIN_WITHDRAWAL_COP)}. La solicitud aparta el monto de tu saldo y la revisa nuestro equipo, que la paga en un plazo de <Ph>[número]</Ph> días
            hábiles.
          </li>
          <li>Pagamos a una cuenta bancaria a nombre de tu empresa, o en USDT a una wallet cuya propiedad demuestras con una firma. Si la cuenta o la dirección están mal, el dinero podría perderse.</li>
          <li>Podemos pedirte información adicional antes de pagar un retiro, o rechazarlo indicando el motivo. En ese caso el monto vuelve a tu saldo.</li>
        </ul>
      </>
    ),
  },
  {
    id: "impuestos",
    title: "Facturación e impuestos",
    body: (
      <p>
        <Ph>[Definir con el contador y el asesor legal: facturación electrónica de los planes, IVA, retención en la fuente y certificados.]</Ph> Cada empresa responde por sus propias obligaciones
        tributarias.
      </p>
    ),
  },
  {
    id: "cierre",
    title: "Cierre de un plan",
    body: (
      <>
        <p>
          Podemos cerrar un plan si el pago que lo activó es reversado o devuelto por el banco o la pasarela, si detectamos fraude o información falsa, o si lo ordena una autoridad. Un plan cerrado
          deja de generar energía y libera su cupo.
        </p>
        <p>
          <Ph>
            [El asesor legal debe definir qué pasa con el saldo cuando el pago fue reversado, y la política de retracto y devoluciones de un mes ya pagado, según el Estatuto del Consumidor cuando
            aplique.]
          </Ph>
        </p>
      </>
    ),
  },
  {
    id: "riesgos",
    title: "Riesgos",
    body: (
      <>
        <ul>
          <li>La utilidad publicada depende de que la energía de tu plan se venda al precio publicado.</li>
          <li>La regulación del sector eléctrico y las normas tributarias pueden cambiar.</li>
          <li>Las criptomonedas son volátiles y sus transacciones no se pueden reversar.</li>
        </ul>
        <p>
          <Ph>
            [Confirmar con el asesor legal y dejar expreso: si {LEGAL.company} es o no una entidad vigilada por la Superintendencia Financiera de Colombia, que un plan de energía no es un depósito
            ni un producto financiero, y que el esquema cumple las normas sobre captación de dineros del público.]
          </Ph>
        </p>
      </>
    ),
  },
  {
    id: "responsabilidad",
    title: "Responsabilidad",
    body: (
      <p>
        {BRAND.name} responde por la prestación diligente de sus servicios. No responde por fallas de terceros (Mercado Pago, redes blockchain, wallets, bancos o proveedores de internet) ni por
        casos de fuerza mayor o caso fortuito. <Ph>[El asesor legal debe ajustar esta cláusula a la ley colombiana.]</Ph>
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios a estos términos",
    body: (
      <p>
        Si cambiamos estos términos, publicaremos la nueva versión y te pediremos aceptarla antes de tu siguiente compra. Los planes ya comprados conservan las condiciones con que se compraron.
        La versión vigente es la {LEGAL.version}.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable y reclamos",
    body: (
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Puedes enviar peticiones, quejas y reclamos a <Ph>{LEGAL.email}</Ph>. Las controversias se resolverán{" "}
        <Ph>[definir: jueces de la ciudad del domicilio, o centro de conciliación y arbitraje]</Ph>.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      intro={
        <p>
          Estos términos regulan el uso de la plataforma {BRAND.name} y la compra de planes de energía. Al registrar tu empresa y comprar un plan, los aceptas en nombre de ella. También aplica
          nuestra{" "}
          <Link href="/privacidad" className="link text-ink">
            Política de Tratamiento de Datos
          </Link>
          .
        </p>
      }
      sections={SECTIONS}
    />
  );
}
