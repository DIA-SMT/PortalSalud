import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Agenda from "./Agenda";
import axiosSalud from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";
import Swal from "../../common/alerta";
import { avisarExito } from "../../helpers/avisos";
import { hoyISO } from "../../helpers/fechas";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn(), post: vi.fn() } };
});
vi.mock("../../helpers/avisos", () => ({ avisarExito: vi.fn(), avisarError: vi.fn() }));
vi.mock("../../common/alerta", () => ({ default: { fire: vi.fn() }, confirmarBorrado: vi.fn() }));

const empleado = (legajo, nombre) => ({ legajo, nombre, reparticion: "Obras (ficticia)" });
const CONTROLES = [
  { id: 1, tipo: "Audiometría", fechaProgramada: hoyISO(5), estado: "programado", lugar: "Consultorio", empleado: empleado(70002, "Prueba, Martín"), pedidoReprogramacion: { id: 9, motivo: "Vacaciones" } },
  { id: 2, tipo: "Examen preocupacional", fechaProgramada: null, estado: "pendiente", lugar: null, empleado: empleado(70021, "Nuevo, Ezequiel"), pedidoReprogramacion: null },
  { id: 3, tipo: "Control de laboratorio", fechaProgramada: hoyISO(5), estado: "realizado", lugar: null, empleado: empleado(70002, "Prueba, Martín"), pedidoReprogramacion: null },
];
const PEDIDOS = [
  { id: 9, motivo: "Vacaciones (ficticio)", creadoEn: new Date().toISOString(), control: { id: 1, tipo: "Audiometría", fechaProgramada: hoyISO(5), estado: "programado" }, empleado: empleado(70002, "Prueba, Martín") },
];

const renderizar = (url = "/salud/gestion/agenda") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Agenda />
    </MemoryRouter>
  );

describe("Agenda de controles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSaludStore.setState({ roles: ["EMPLEADO", "PROFESIONAL_SALUD"] });
    axiosSalud.get.mockImplementation(async (url) => {
      if (url.startsWith("/gestion/agenda/pedidos")) return { data: { pedidos: PEDIDOS } };
      if (url.startsWith("/gestion/agenda/empleados")) return { data: { empleados: [{ legajo: 70021, apellido: "Nuevo", nombre: "Ezequiel", reparticion: "Obras", activo: true, ingresoAlPortal: false }] } };
      return { data: { controles: CONTROLES, tiposSugeridos: ["Audiometría", "Examen periódico anual"] } };
    });
    axiosSalud.post.mockResolvedValue({ data: { ok: true } });
  });

  it("agrupa por fecha, marca pedidos y no ofrece acciones en controles cerrados", async () => {
    renderizar();
    expect(await screen.findByText("Sin fecha asignada")).toBeInTheDocument();
    expect(screen.getByText("Pidió cambiar la fecha")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Reprogramar:/ })).toHaveLength(2); // el realizado no
    expect(axiosSalud.get).toHaveBeenCalledWith(`/gestion/agenda?desde=${hoyISO()}&hasta=${hoyISO(30)}`);
  });

  it("registra un control como realizado con próxima revisión", async () => {
    renderizar();
    fireEvent.click((await screen.findAllByRole("button", { name: /^Registrar realizado: Audiometría/ }))[0]);
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText(/Próxima revisión/), { target: { value: hoyISO(365) } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Registrar" }));
    await waitFor(() =>
      expect(axiosSalud.post).toHaveBeenCalledWith("/gestion/agenda/1/realizado", { fechaRealizacion: hoyISO(), proximaRevision: hoyISO(365) })
    );
    expect(avisarExito).toHaveBeenCalledWith("Control registrado como realizado");
  });

  it("pide confirmación para cancelar", async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });
    renderizar();
    fireEvent.click((await screen.findAllByRole("button", { name: /^Cancelar: Audiometría/ }))[0]);
    await waitFor(() => expect(axiosSalud.post).toHaveBeenCalledWith("/gestion/agenda/1/cancelacion"));
  });

  it("acepta un pedido solo con nueva fecha", async () => {
    renderizar("/salud/gestion/agenda?vista=pedidos");
    expect(await screen.findByText("“Vacaciones (ficticio)”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar con nueva fecha" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aceptar y reprogramar" }));
    expect(await within(dialogo).findByText("Elegí la nueva fecha.")).toBeInTheDocument();
    expect(axiosSalud.post).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText(/Nueva fecha/), { target: { value: hoyISO(20) } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aceptar y reprogramar" }));
    await waitFor(() =>
      expect(axiosSalud.post).toHaveBeenCalledWith("/gestion/agenda/pedidos/9/resolucion", { decision: "aceptada", nuevaFecha: hoyISO(20) })
    );
  });

  it("programa un control nuevo para un empleado del padrón", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo control" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Programar" }));
    expect(await within(dialogo).findByText("Elegí un empleado")).toBeInTheDocument();

    const campoEmpleado = within(dialogo).getByLabelText(/Empleado/);
    fireEvent.change(campoEmpleado, { target: { value: "nuevo" } });
    fireEvent.click(await screen.findByRole("option", { name: /Nuevo, Ezequiel/ }));
    fireEvent.change(within(dialogo).getByLabelText(/Tipo de control/), { target: { value: "Examen preocupacional" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Programar" }));
    await waitFor(() =>
      expect(axiosSalud.post).toHaveBeenCalledWith(
        "/gestion/agenda",
        expect.objectContaining({ legajo: 70021, tipo: "Examen preocupacional", fechaProgramada: undefined })
      )
    );
  });

  it("sin rol de salud no muestra la agenda", () => {
    useSaludStore.setState({ roles: ["EMPLEADO", "RECURSOS_HUMANOS"] });
    renderizar();
    expect(screen.getByText("No tenés permiso para gestionar la agenda de controles.")).toBeInTheDocument();
  });
});
