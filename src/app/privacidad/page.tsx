import type { Metadata } from "next";
import { LEGAL } from "@/config/legal";
import { LegalPage, Ph, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de Tratamiento de Datos" };

const SECTIONS: LegalSection[] = [
  {
    id: "responsable",
    title: "Responsable del tratamiento",
    body: (
      <p>
        {LEGAL.company}, NIT <Ph>{LEGAL.nit}</Ph>, domicilio <Ph>{LEGAL.address}</Ph>, <Ph>{LEGAL.city}</Ph>. Correo para asuntos de
        datos personales: <Ph>{LEGAL.email}</Ph>. Teléfono: <Ph>{LEGAL.phone}</Ph>.
      </p>
    ),
  },
  {
    id: "datos",
    title: "Qué datos tratamos",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Identificación:</strong> nombre completo o razón social, tipo y número de documento.
        </li>
        <li>
          <strong>Contacto:</strong> correo electrónico, celular y ciudad.
        </li>
        <li>
          <strong>Cuenta de Google:</strong> nombre, correo y foto de perfil, que Google nos comparte cuando ingresas.
        </li>
        <li>
          <strong>Operaciones:</strong> compras, ventas y retiros; direcciones públicas de wallet; hashes de transacciones; referencias de
          pago de Wompi. No recibimos ni guardamos los datos de tu tarjeta.
        </li>
        <li>
          <strong>Datos técnicos:</strong> dirección IP, navegador y registros de seguridad.
        </li>
      </ul>
    ),
  },
  {
    id: "finalidades",
    title: "Para qué los usamos",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Crear y administrar tu cuenta y registrar tu participación en la planta.</li>
        <li>Procesar tus pagos, liquidar tus ingresos y pagar tus retiros.</li>
        <li>Cumplir obligaciones legales, contables y tributarias, y las de prevención de lavado de activos y financiación del terrorismo.</li>
        <li>Prevenir fraudes y proteger la seguridad de la plataforma.</li>
        <li>Atender tus peticiones, quejas y reclamos, y enviarte información sobre tu inversión.</li>
        <li>Elaborar estadísticas agregadas que no te identifican.</li>
      </ul>
    ),
  },
  {
    id: "sensibles",
    title: "Datos sensibles y de menores",
    body: <p>No pedimos datos sensibles ni datos de menores de edad. Si alguna vez te los pidiéramos, responder sería opcional.</p>,
  },
  {
    id: "derechos",
    title: "Tus derechos",
    body: (
      <>
        <p>Según la Ley 1581 de 2012, como titular de los datos puedes:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Saber cómo hemos usado tus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
          <li>
            Revocar la autorización o pedir que borremos tus datos, salvo cuando la ley o un contrato vigente nos obliguen a conservarlos.
          </li>
          <li>Acceder gratis a tus datos.</li>
        </ul>
      </>
    ),
  },
  {
    id: "procedimiento",
    title: "Cómo ejercerlos",
    body: (
      <p>
        Escribe a <Ph>{LEGAL.email}</Ph> con tu nombre, documento y lo que necesitas. Respondemos las consultas en un máximo de 10 días
        hábiles y los reclamos en un máximo de 15 días hábiles. Si necesitamos más tiempo, te avisaremos antes de que venza el plazo, como lo
        permite la ley.
      </p>
    ),
  },
  {
    id: "encargados",
    title: "Con quién los compartimos",
    body: (
      <>
        <p>Solo con los proveedores que necesitamos para prestar el servicio, que tratan los datos por encargo nuestro:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Wompi, para procesar pagos con tarjeta, PSE y Nequi.</li>
          <li>Google, para el inicio de sesión.</li>
          <li>Vercel y Turso, para alojar la plataforma y su base de datos. Pueden guardar información fuera de Colombia.</li>
        </ul>
        <p>También los entregamos a las autoridades cuando la ley lo exige.</p>
      </>
    ),
  },
  {
    id: "seguridad",
    title: "Seguridad y conservación",
    body: (
      <p>
        Protegemos tus datos con conexiones cifradas, accesos restringidos y registros de actividad. Los conservamos mientras tengas una
        cuenta y luego por el tiempo que exijan las normas contables, tributarias y de prevención de lavado de activos.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: <p>Usamos cookies propias para mantener tu sesión abierta y recordar tus preferencias. No usamos cookies de publicidad.</p>,
  },
  {
    id: "vigencia",
    title: "Vigencia",
    body: (
      <p>
        Esta política rige desde el <Ph>[fecha de publicación]</Ph> (versión {LEGAL.version}). Si la cambiamos, te pediremos aceptarla de
        nuevo antes de tu siguiente compra.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de Tratamiento de Datos Personales"
      intro={
        <p>
          Aquí explicamos qué datos personales tratamos, para qué y cuáles son tus derechos, conforme a la Ley 1581 de 2012 y sus decretos
          reglamentarios.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
