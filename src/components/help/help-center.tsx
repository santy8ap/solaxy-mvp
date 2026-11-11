"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";

const questions = [
  {
    category: "Planes",
    q: "¿Qué incluye cada plan?",
    a: "Cada plan define una cantidad diaria de energía, un precio por kWh y una duración de tres meses. El pago es mensual y la comparación utiliza periodos de 30 días. Puedes revisar las cantidades y los valores antes de decidir.",
  },
  {
    category: "Planes",
    q: "¿Puedo contratar un plan en este momento?",
    a: "El catálogo y el resumen del plan están disponibles para consulta. La activación del contrato y el cobro mensual todavía no están habilitados. Revisar una selección no reserva energía ni crea una obligación de pago.",
  },
  {
    category: "Planes",
    q: "¿Por qué un plan puede tener un precio por kWh menor y una cuota mayor?",
    a: "La cuota depende tanto del precio como del volumen de energía. Se calcula multiplicando los kWh mensuales por el precio de compra de cada kWh. El comparador muestra ambos valores para ayudarte a valorar la diferencia.",
  },
  {
    category: "Planes",
    q: "¿Qué significa la utilidad bruta de referencia?",
    a: "Es la diferencia entre la venta de referencia de $400/kWh y el precio de compra, dividida entre el precio de compra. No incluye costos ni impuestos y no garantiza un rendimiento. No equivale al descuento sobre el precio de venta.",
  },
  {
    category: "Pagos",
    q: "¿Qué significa cada estado de una operación?",
    a: "Pendiente indica que aún falta una confirmación; verificando indica que se está revisando; confirmada indica que el servidor registró la confirmación. Fallida, rechazada o cancelada indican que la operación no se completó como se esperaba. Por reembolsar requiere resolver la devolución; reembolsada indica que se registró su devolución.",
  },
  {
    category: "Pagos",
    q: "¿Qué hago si un pago sigue pendiente?",
    a: "Consulta su detalle en Movimientos y conserva la referencia. Algunos métodos requieren tiempo de confirmación. Revisa el estado antes de repetir la operación, para evitar pagos duplicados.",
  },
  {
    category: "Pagos",
    q: "¿Cómo obtengo un resumen de una operación?",
    a: "En Movimientos, abre el detalle de la operación y elige Imprimir / PDF. El navegador permite imprimir o guardar como PDF. También puedes exportar un CSV. El resumen es informativo y no sustituye una factura.",
  },
  {
    category: "Cuenta",
    q: "¿Cómo oculto mis montos al compartir pantalla?",
    a: "Pulsa Ocultar importes en la parte superior del panel. La preferencia se conserva en este navegador y también oculta los importes de las gráficas y los movimientos. Usa Mostrar importes para volver a consultar o exportar los valores.",
  },
  {
    category: "Cuenta",
    q: "¿Qué datos necesita una empresa?",
    a: "La revisión de un plan solicita razón social, NIT, representante legal y correo empresarial. Los datos escritos en esa revisión solo se mantienen mientras la ventana está abierta. La información de Mi cuenta se guarda únicamente al usar Guardar información.",
  },
  {
    category: "Cuenta",
    q: "¿Cómo reviso o solicito un retiro?",
    a: "Abre Billetera, conecta tu wallet y consulta el saldo disponible. La solicitud muestra su mínimo, el monto, la red y la dirección antes de la firma. Puedes seguir su estado en Movimientos. Una solicitud en revisión puede reservar parte del saldo.",
  },
  {
    category: "Energía",
    q: "¿Qué diferencia hay entre kW y kWh?",
    a: "Los kW expresan potencia en un instante. Los kWh expresan una cantidad de energía acumulada durante un tiempo. Una potencia constante de 1 kW durante una hora equivale a 1 kWh. Los planes se expresan en kWh y la curva solar, en kW.",
  },
  {
    category: "Energía",
    q: "¿El reloj solar es una lectura de medidores?",
    a: "El reloj es una proyección de referencia de 6 a. m. a 7 p. m., en hora de Colombia, con máximo visual de 8.000 kW. Puedes explorar cada hora con el cursor, el toque o el control de rango. La proyección no confirma energía generada ni determina el saldo de tu cuenta.",
  },
] as const;
const categories = ["Todos", "Planes", "Pagos", "Cuenta", "Energía"] as const;
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function HelpCenter() {
  const [category, setCategory] =
    useState<(typeof categories)[number]>("Todos");
  const [search, setSearch] = useState("");
  const filtered = questions.filter(
    (question) =>
      (category === "Todos" || question.category === category) &&
      normalize(`${question.q} ${question.a}`).includes(
        normalize(search.trim()),
      ),
  );
  return (
    <>
      <div className="resource-hero">
        <span className="eyebrow">IN WORLD ENERGY / CENTRO DE AYUDA</span>
        <h1>
          LA CLARIDAD
          <br />
          TAMBIÉN MUEVE.
        </h1>
        <p>Entiende tus planes, tus operaciones y la energía que hay detrás.</p>
      </div>
      <label className="help-search">
        <Search size={22} aria-hidden="true" />
        <span className="sr-only">Buscar en el centro de ayuda</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Busca sobre planes, pagos, energía…"
        />
      </label>
      <div
        className="help-categories"
        role="group"
        aria-label="Categorías de ayuda"
      >
        {categories.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={value === category}
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="resource-count" role="status">
        {filtered.length}{" "}
        {filtered.length === 1
          ? "respuesta disponible"
          : "respuestas disponibles"}
      </p>
      <div className="help-questions">
        {filtered.map((question) => (
          <details key={question.q}>
            <summary>
              <span>
                <small>{question.category}</small>
                {question.q}
              </span>
              <span aria-hidden="true">+</span>
            </summary>
            <p>{question.a}</p>
          </details>
        ))}
        {!filtered.length && (
          <div className="empty-state">
            <h2>No encontramos esa respuesta.</h2>
            <p>Prueba una palabra más corta o consulta todas las categorías.</p>
            <button
              type="button"
              className="btn btn-ghost mt-6"
              onClick={() => {
                setSearch("");
                setCategory("Todos");
              }}
            >
              Mostrar todas las respuestas
            </button>
          </div>
        )}
      </div>
      <section className="energy-glossary" aria-labelledby="glossary-title">
        <span className="eyebrow">EL LENGUAJE DE TU ENERGÍA</span>
        <h2 id="glossary-title">Cuatro conceptos. Más claridad.</h2>
        <dl>
          {[
            ["kW", "Potencia instantánea de un sistema."],
            ["kWh", "Energía acumulada a lo largo del tiempo."],
            ["COP", "Pesos colombianos, moneda de los valores del catálogo."],
            [
              "Utilidad bruta",
              "Diferencia de referencia entre ingreso y costo de compra, antes de costos adicionales e impuestos.",
            ],
          ].map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="help-links">
        <Link href="/planes" className="btn btn-sun">
          Explorar planes <ArrowUpRight size={15} />
        </Link>
        <Link href="/panel/movimientos" className="btn btn-ghost">
          Consultar mis movimientos <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
}
