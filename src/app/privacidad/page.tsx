import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { LEGAL } from "@/config/legal";
import { LegalPage, Ph, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de Tratamiento de Datos" };

const SECTIONS: LegalSection[] = [
  {
    id: "responsable",
    title: "Responsable del tratamiento",
    body: (
      <p>
        {LEGAL.company}, NIT <Ph>{LEGAL.nit}</Ph>, domicilio <Ph>{LEGAL.address}</Ph>, <Ph>{LEGAL.city}</Ph>. Correo para asuntos de datos personales: <Ph>{LEGAL.email}</Ph>. Teléfono:{" "}
        <Ph>{LEGAL.phone}</Ph>.
      </p>
    ),
  },
  {
    id: "datos",
    title: "Qué datos tratamos",
    body: (
      <>
        <p>
          Esta política describe el tratamiento de los datos personales que proporcionas al registrarte como comercializador y comprar planes de energía en {BRAND.name}.
        </p>
        <ul>
          <li>
            <strong>Comercializador:</strong> nombre completo, tipo y número de documento, celular y ciudad de residencia.
          </li>
          <li>
            <strong>Cuenta de Google:</strong> nombre, correo y foto de perfil, que Google nos comparte cada vez que ingresas. La foto se muestra en tu panel.
          </li>
          <li>
            <strong>Operaciones del comercializador:</strong> planes comprados, pagos y retiros; referencias de pago de Mercado Pago; números de comprobante y referencias de las transferencias
            bancarias que nos reportas; direcciones públicas de wallet y hashes de transacciones; banco, tipo y número de la cuenta a la que se pagan los retiros. No recibimos ni guardamos los datos
            de tu tarjeta.
          </li>
          <li>
            <strong>Solicitudes sobre tus datos:</strong> las descargas y las solicitudes de eliminación de la cuenta, con su motivo y nuestra respuesta.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, navegador y registros de seguridad. También medimos las visitas y la velocidad de la página sin cookies: qué páginas se visitan, desde qué
            país, con qué tipo de dispositivo y navegador, y cuánto tardan en cargar. Esa medición no identifica a nadie y no incluye la administración.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para qué los usamos",
    body: (
      <ul>
        <li>Crear y administrar la cuenta del comercializador y registrar sus planes de energía.</li>
        <li>Procesar los pagos, calcular la energía y el saldo de cada plan y pagar los retiros.</li>
        <li>Cumplir obligaciones legales, contables y tributarias, y las de prevención de lavado de activos y financiación del terrorismo.</li>
        <li>Prevenir fraudes y proteger la seguridad de la plataforma.</li>
        <li>Atender peticiones, quejas y reclamos, y enviar información sobre los planes del comercializador, como el vencimiento de un mes o el final de un plan.</li>
        <li>Avisar por correo a nuestro equipo cuando entra un pago, cuando reportas una transferencia, cuando pides un retiro o cuando algo falla, para atenderlo a tiempo.</li>
        <li>Elaborar estadísticas agregadas que no identifican a nadie y medir las visitas y la velocidad de la página para mejorarla.</li>
      </ul>
    ),
  },
  {
    id: "sensibles",
    title: "Datos sensibles y de menores",
    body: <p>No pedimos datos sensibles ni datos de menores de edad. Si alguna vez los pidiéramos, responder sería opcional.</p>,
  },
  {
    id: "derechos",
    title: "Tus derechos",
    body: (
      <>
        <p>Según la Ley 1581 de 2012, como titular de los datos puedes:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Saber cómo hemos usado tus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
          <li>Revocar la autorización o pedir que borremos tus datos, salvo cuando la ley o un contrato vigente nos obliguen a conservarlos.</li>
          <li>Acceder gratis a tus datos.</li>
        </ul>
      </>
    ),
  },
  {
    id: "procedimiento",
    title: "Cómo ejercerlos",
    body: (
      <>
        <p>
          Desde tu perfil puedes descargar tus datos y pedir que eliminemos tu cuenta. También puedes escribir a <Ph>{LEGAL.email}</Ph> con tu nombre, tu documento y lo que necesitas. Respondemos
          las consultas en un máximo de 10 días hábiles y los reclamos, como una solicitud de eliminación, en un máximo de 15 días hábiles. Si necesitamos más tiempo, te avisaremos antes de que
          venza el plazo, como lo permite la ley.
        </p>
        <p>
          Al eliminar tu cuenta quitamos el acceso, el correo, el celular, la ciudad, la foto y la wallet vinculada. Si alguna vez pagaste un plan, conservamos tu nombre, tu documento y tus
          movimientos durante el tiempo que exigen las normas contables, tributarias y de prevención de lavado de activos; si nunca pagaste, borramos también tus datos personales. Mientras tengas un
          plan vigente, saldo a favor o pagos, retiros o devoluciones en curso, primero hay que cerrarlos.
        </p>
      </>
    ),
  },
  {
    id: "encargados",
    title: "Con quién los compartimos",
    body: (
      <>
        <p>Solo con los proveedores que necesitamos para prestar el servicio, que tratan los datos por encargo nuestro:</p>
        <ul>
          <li>Mercado Pago, para procesar pagos con tarjeta, PSE y Nequi.</li>
          <li>Google, para el inicio de sesión.</li>
          <li>
            Vercel y Turso, para alojar la plataforma y su base de datos. Vercel también mide, sin cookies y sin identificar a nadie, las visitas y la velocidad de la página.
          </li>
          <li>
            Resend, para enviar a nuestro equipo los avisos internos por correo. Esos avisos llevan tu nombre, los montos y las referencias de cada operación (y, si pides eliminar tu cuenta, el
            motivo que escribas), pero no tu documento ni tus números de cuenta.
          </li>
          <li>Los bancos por donde recibimos transferencias y pagamos retiros, y las redes blockchain por donde se paga con cripto.</li>
        </ul>
        <p>
          Estos proveedores pueden guardar información fuera de Colombia, por ejemplo en Estados Unidos. También entregamos los datos a las autoridades cuando la ley lo exige.
        </p>
        <p>
          <Ph>[El asesor legal debe confirmar los contratos de transmisión con cada proveedor y las condiciones para enviar datos fuera de Colombia, según la Ley 1581 de 2012 y el Decreto 1377 de 2013.]</Ph>
        </p>
      </>
    ),
  },
  {
    id: "seguridad",
    title: "Seguridad y conservación",
    body: (
      <p>
        Protegemos los datos con conexiones cifradas, accesos restringidos y un registro de lo que hace cada administrador. Los conservamos mientras el comercializador tenga una cuenta y luego por el
        tiempo que exijan las normas contables, tributarias y de prevención de lavado de activos.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        Usamos cookies propias para mantener la sesión abierta y, para nuestro equipo, el acceso a la administración. No usamos cookies de publicidad ni de seguimiento, y la medición de visitas no
        usa cookies. Tu navegador guarda además algunas preferencias para que la página funcione mejor: el tema de colores, los avisos que cerraste, la última wallet que usaste y los pagos con
        cripto que tienes en curso. Esas preferencias no salen de tu navegador.
      </p>
    ),
  },
  {
    id: "vigencia",
    title: "Vigencia",
    body: (
      <p>
        Esta política rige desde el <Ph>[fecha de publicación]</Ph> (versión {LEGAL.version}). Si la cambiamos, te pediremos aceptarla de nuevo antes de tu siguiente compra.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de Tratamiento de Datos"
      intro={<p>Aquí explicamos qué datos personales tratamos, para qué y cuáles son tus derechos, conforme a la Ley 1581 de 2012 y sus decretos reglamentarios.</p>}
      sections={SECTIONS}
    />
  );
}
