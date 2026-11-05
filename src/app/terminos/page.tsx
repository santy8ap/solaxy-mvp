import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/config/legal";
import { LegalPage, Ph, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Términos y Condiciones" };

const SECTIONS: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    body: (
      <p>
        La plataforma Solaxy es operada por {LEGAL.company}, sociedad identificada con NIT <Ph>{LEGAL.nit}</Ph>, con domicilio en{" "}
        <Ph>{LEGAL.address}</Ph>, <Ph>{LEGAL.city}</Ph>. Puedes contactarnos en <Ph>{LEGAL.email}</Ph> o al <Ph>{LEGAL.phone}</Ph>.
      </p>
    ),
  },
  {
    id: "objeto",
    title: "Qué ofrece la plataforma",
    body: (
      <>
        <p>
          Solaxy permite adquirir participaciones expresadas en kilovatios (kW) de capacidad de una planta solar, y recibir la parte de los
          ingresos netos por venta de energía que corresponde a esos kW, en proporción a la capacidad total de la planta.
        </p>
        <p>
          La figura jurídica de la participación es <Ph>[definir con el asesor legal: por ejemplo, contrato de cuentas en participación,
          fiducia o derechos económicos]</Ph>. Comprar kW no te convierte en accionista de {LEGAL.company} ni en propietario de equipos
          específicos de la planta.
        </p>
      </>
    ),
  },
  {
    id: "cuenta",
    title: "Tu cuenta",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Debes ser mayor de edad y entregar datos verdaderos, completos y actualizados. Cada persona o empresa tiene una sola cuenta.</li>
        <li>Ingresas con tu cuenta de Google. Eres responsable de su seguridad y de lo que se haga desde ella.</li>
        <li>
          Para cumplir las normas de prevención de lavado de activos y financiación del terrorismo, podemos pedirte documentos adicionales,
          verificar tu identidad y suspender o rechazar operaciones cuando haya alertas.
        </li>
      </ul>
    ),
  },
  {
    id: "compras",
    title: "Compras y pagos",
    body: (
      <>
        <p>
          El precio por kW es el publicado en la plataforma al momento de la compra. Los kW se asignan a tu cuenta solo cuando el pago queda
          confirmado.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Tarjeta, PSE y Nequi:</strong> se procesan a través de Mercado Pago, que aplica sus propios términos. Solaxy no recibe ni guarda
            los datos de tu tarjeta.
          </li>
          <li>
            <strong>Cripto (USDT o BNB en BNB Chain):</strong> la cotización tiene una vigencia de 20 minutos. Debes enviar al menos el monto
            exacto, desde la wallet conectada, a la dirección que muestra la plataforma y en la red BNB Smart Chain. Las transacciones en
            blockchain son irreversibles: un envío por otra red, a otra dirección o con un monto menor puede perderse o requerir una gestión
            manual que no podemos garantizar.
          </li>
        </ul>
        <p>
          Si un pago se confirma y la planta ya no tiene kW disponibles, te devolveremos el dinero por el mismo medio cuando sea posible, en
          un plazo de <Ph>[número]</Ph> días hábiles.
        </p>
      </>
    ),
  },
  {
    id: "ingresos",
    title: "Ingresos, comisión y telemetría",
    body: (
      <>
        <p>
          Tus ingresos dependen de la energía que produzca y entregue la planta, de las tarifas de venta y de su disponibilidad. Solaxy
          retiene el porcentaje de comisión de operación y plataforma publicado en la plataforma.
        </p>
        <p>
          <strong>La rentabilidad que mostramos es una estimación y no está garantizada.</strong> Mientras la planta no tenga sus medidores
          conectados a la plataforma, la telemetría es una simulación y las ganancias que ves son estimadas.
        </p>
      </>
    ),
  },
  {
    id: "retiros",
    title: "Retiros",
    body: (
      <p>
        Puedes solicitar el retiro de tu saldo disponible. Cada solicitud la revisa nuestro equipo y se paga en un plazo de{" "}
        <Ph>[número]</Ph> días hábiles a la wallet o cuenta que indiques. Podemos pedirte información adicional antes de aprobarla. Si
        indicas mal la dirección o la cuenta, el dinero podría perderse.
      </p>
    ),
  },
  {
    id: "mercado",
    title: "Mercado entre inversionistas y venta inmediata",
    body: (
      <p>
        Puedes ofrecer tus kW a otros inversionistas al precio que elijas dentro del rango permitido, o venderlos a la plataforma con la
        venta inmediata, a un porcentaje del precio vigente. Solaxy no garantiza que haya compradores ni que la venta inmediata esté
        siempre disponible.
      </p>
    ),
  },
  {
    id: "riesgos",
    title: "Riesgos",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>La producción solar varía con el clima, el estado de los equipos y la demanda de energía.</li>
        <li>Las tarifas de venta de energía y la regulación del sector pueden cambiar.</li>
        <li>Puede que no encuentres a quién vender tus kW cuando quieras.</li>
        <li>Las criptomonedas son volátiles y sus transacciones no se pueden reversar.</li>
        <li>Puedes perder parte o la totalidad de lo invertido.</li>
      </ul>
    ),
  },
  {
    id: "responsabilidad",
    title: "Responsabilidad",
    body: (
      <p>
        Solaxy responde por la prestación diligente de sus servicios. No responde por fallas de terceros (Mercado Pago, redes blockchain, wallets,
        proveedores de internet) ni por casos de fuerza mayor o caso fortuito. <Ph>[El abogado debe ajustar esta cláusula a la ley
        colombiana y al Estatuto del Consumidor cuando aplique.]</Ph>
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios a estos términos",
    body: (
      <p>
        Si cambiamos estos términos, publicaremos la nueva versión y te pediremos aceptarla antes de tu siguiente compra. La versión vigente
        es la {LEGAL.version}.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable y reclamos",
    body: (
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Puedes enviar peticiones, quejas y reclamos a{" "}
        <Ph>{LEGAL.email}</Ph>. Las controversias se resolverán <Ph>[definir: jueces de la ciudad del domicilio o centro de conciliación y
        arbitraje]</Ph>.
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
          Estos términos regulan el uso de la plataforma Solaxy. Al crear tu cuenta y comprar kW los aceptas. Léelos con calma; también
          aplica nuestra{" "}
          <Link href="/privacidad" className="text-sun-300 underline underline-offset-2">
            Política de Tratamiento de Datos
          </Link>
          .
        </p>
      }
      sections={SECTIONS}
    />
  );
}
