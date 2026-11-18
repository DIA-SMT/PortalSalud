import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MiSalud from "./MiSalud";
import axiosSalud from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn() } };
});

const enDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const RESUMEN = {
  proximoControl: { id: 1, tipo: "Examen periódico anual", fechaProgramada: enDias(6), estado: "programado", lugar: "Consultorio ficticio", responsable: "Servicio ficticio" },
  controlesPendientes: { cantidad: 1, items: [{ id: 2, tipo: "Control de agudeza visual", fechaProgramada: enDias(-10), estado: "vencido" }] },
  ultimosControles: [],
  documentos: { disponibles: 1, pendientesValidacion: 1 },
  recordatorios: [{ id: 5, tipo: "control", titulo: "Tenés un control en 6 días", mensaje: "Recordá asistir." }],
  completitud: { porcentaje: 50, items: [{ clave: "a", etiqueta: "Contacto de emergencia", completo: true }, { clave: "b", etiqueta: "Medios de contacto", completo: false }] },
};

const renderizar = () =>
  render(
    <MemoryRouter>
      <MiSalud />
    </MemoryRouter>
  );

describe("MiSalud (dashboard)", () => {
  beforeEach(() => {
    useSaludStore.setState({ usuario: { nombre: "Lucía", apellido: "Ficticia", legajo: 70001, reparticion: "Hacienda (ficticia)" } });
    axiosSalud.get.mockReset();
  });

  it("muestra el resumen del empleado", async () => {
    axiosSalud.get.mockResolvedValue({ data: RESUMEN });
    renderizar();

    expect(screen.getByRole("heading", { level: 1, name: "Hola, Lucía" })).toBeInTheDocument();
    expect(screen.getByText("Legajo 70001 · Hacienda (ficticia)")).toBeInTheDocument();
    expect(await screen.findByText("Examen periódico anual")).toBeInTheDocument();
    expect(screen.getByText("En 6 días")).toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText("Tenés un control en 6 días")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay controles registrados.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Porcentaje de la ficha completado" })).toHaveAttribute("aria-valuenow", "50");
    expect(axiosSalud.get).toHaveBeenCalledWith("/salud/mi-resumen");
  });

  it("muestra estados vacíos", async () => {
    axiosSalud.get.mockResolvedValue({
      data: { ...RESUMEN, proximoControl: null, controlesPendientes: { cantidad: 0, items: [] }, recordatorios: [] },
    });
    renderizar();
    expect(await screen.findByText("No tenés controles programados por ahora.")).toBeInTheDocument();
    expect(screen.getByText("No tenés controles pendientes.")).toBeInTheDocument();
    expect(screen.getByText("No tenés recordatorios nuevos.")).toBeInTheDocument();
  });

  it("muestra un error comprensible con opción de reintentar", async () => {
    axiosSalud.get.mockRejectedValue({ response: { data: { message: "Tu sesión venció." } } });
    renderizar();
    expect(await screen.findByText("Tu sesión venció.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
