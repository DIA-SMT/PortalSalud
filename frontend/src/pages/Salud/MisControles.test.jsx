import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MisControles from "./MisControles";
import axiosSalud from "../../config/axiosSalud";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn() } };
});

const enDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const control = (id, tipo, estado, extra = {}) => ({
  id, tipo, estado, fechaProgramada: null, fechaRealizacion: null, lugar: "Consultorio ficticio",
  responsable: "Servicio ficticio", proximaRevision: null, documentos: [], ...extra,
});

const CONTROLES = [
  control(1, "Control de agudeza visual", "vencido", { fechaProgramada: enDias(-10) }),
  control(2, "Examen periódico anual", "programado", { fechaProgramada: enDias(0) }),
  control(3, "Control de laboratorio", "realizado", {
    fechaProgramada: enDias(-200), fechaRealizacion: enDias(-200), proximaRevision: enDias(165),
    documentos: [{ id: "a-1", tipo: "constancia", titulo: "Constancia ficticia", estadoValidacion: "validado" }],
  }),
  control(4, "Actualización de vacunación", "pendiente"),
];

const renderizar = (url = "/salud/controles") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MisControles />
    </MemoryRouter>
  );

describe("MisControles", () => {
  beforeEach(() => {
    axiosSalud.get.mockReset();
    axiosSalud.get.mockResolvedValue({ data: { controles: CONTROLES } });
  });

  it("lista todos los controles con contadores por filtro", async () => {
    renderizar();
    expect(await screen.findByText("Control de agudeza visual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos (4)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pendientes (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Realizados (1)" })).toBeInTheDocument();
  });

  it("filtra y muestra el estado vacío del filtro", async () => {
    renderizar("/salud/controles?filtro=cancelados");
    expect(await screen.findByText("No hay controles cancelados.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pendientes (2)" }));
    expect(screen.getByText("Actualización de vacunación")).toBeInTheDocument();
    expect(screen.queryByText("Examen periódico anual")).not.toBeInTheDocument();
  });

  it("abre el detalle con próxima revisión y documentos asociados", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: /Control de laboratorio.*Ver detalle/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Próxima revisión")).toBeInTheDocument();
    expect(within(dialogo).getByText("Constancia ficticia")).toBeInTheDocument();
    // Un control realizado no ofrece reprogramar.
    expect(within(dialogo).queryByText(/cambiar la fecha/)).not.toBeInTheDocument();
  });

  it("en el calendario marca el día de hoy y lista sus controles", async () => {
    renderizar("/salud/controles?vista=calendario");
    const hoy = await screen.findByRole("button", { current: "date" });
    expect(hoy).toHaveAccessibleName(/1 control$/);
    expect(hoy).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Examen periódico anual")).toBeInTheDocument();
    // Los controles sin fecha se listan aparte.
    expect(screen.getByText("Sin fecha asignada")).toBeInTheDocument();
    expect(screen.getByText("Actualización de vacunación")).toBeInTheDocument();
  });

  it("permite pedir otra fecha cuando está permitido", async () => {
    const reprogramable = control(9, "Evaluación ergonómica", "programado", {
      fechaProgramada: enDias(20), puedeSolicitarReprogramacion: true, solicitudReprogramacion: null,
    });
    axiosSalud.get.mockResolvedValue({ data: { controles: [reprogramable] } });
    axiosSalud.post = vi.fn().mockResolvedValue({
      data: { ...reprogramable, puedeSolicitarReprogramacion: false, solicitudReprogramacion: { id: 1, estado: "pendiente" } },
    });
    renderizar("/salud/controles?control=9");

    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Pedir otra fecha" }));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar pedido" }));
    expect(await within(dialogo).findByText("Motivo: escribí al menos 5 caracteres")).toBeInTheDocument();

    fireEvent.change(within(dialogo).getByLabelText(/Motivo/), { target: { value: "Estoy de licencia" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar pedido" }));
    expect(await within(dialogo).findByText(/Pediste otra fecha/)).toBeInTheDocument();
    expect(axiosSalud.post).toHaveBeenCalledWith("/salud/controles/9/reprogramacion", { motivo: "Estoy de licencia" });
  });

  it("muestra el error con opción de reintentar", async () => {
    axiosSalud.get.mockRejectedValue({ response: { data: { message: "Tu sesión venció." } } });
    renderizar();
    expect(await screen.findByText("Tu sesión venció.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
