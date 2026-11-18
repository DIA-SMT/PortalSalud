import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Correcciones from "./Correcciones";
import axiosSalud from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn(), post: vi.fn() } };
});
vi.mock("../../helpers/avisos", () => ({ avisarExito: vi.fn(), avisarError: vi.fn() }));

const correccion = (id, extra) => ({
  id, tipo: "administrativa", seccion: "Información laboral", campo: "Puesto", accion: "modificar",
  valorAnterior: "Operario", valorNuevo: "Capataz de cuadrilla", estado: "pendiente",
  persona: { nombre: "Martín Prueba", legajo: 70002, reparticion: "Obras (ficticia)" },
  creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(), nota: null, ...extra,
});

const renderizar = () =>
  render(
    <MemoryRouter initialEntries={["/salud/gestion/correcciones"]}>
      <Correcciones />
    </MemoryRouter>
  );

describe("Correcciones (bandeja de Capital Humano)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSaludStore.setState({ roles: ["EMPLEADO", "RECURSOS_HUMANOS"], actualizarPendientesRevision: vi.fn() });
    axiosSalud.get.mockResolvedValue({
      data: {
        correcciones: [
          correccion("a-1"),
          correccion("c-2", { tipo: "clinica", seccion: "Información de salud", campo: "Medicación", accion: "crear", valorAnterior: null, valorNuevo: "Medicación ficticia" }),
        ],
        puedeRevisar: { administrativas: true, clinicas: true },
      },
    });
  });

  it("muestra el cambio con el valor anterior y el nuevo, y marca lo confidencial", async () => {
    renderizar();
    expect(await screen.findByText("Operario")).toBeInTheDocument();
    expect(screen.getByText("Capataz de cuadrilla")).toBeInTheDocument();
    expect(screen.getByText("Información de salud · Agregó medicación")).toBeInTheDocument();
    expect(screen.getByText("Sin dato")).toBeInTheDocument();
    expect(screen.getAllByText("Confidencial")).toHaveLength(1);
  });

  it("marca como revisada y la saca de pendientes", async () => {
    axiosSalud.post.mockResolvedValue({ data: correccion("a-1", { estado: "revisada" }) });
    renderizar();
    fireEvent.click((await screen.findAllByRole("button", { name: "Marcar como revisada" }))[0]);
    await waitFor(() => expect(screen.queryByText("Operario")).not.toBeInTheDocument());
    expect(axiosSalud.post).toHaveBeenCalledWith("/gestion/correcciones/a-1/resolucion", { decision: "revisada", nota: undefined });
  });

  it("restaura el dato anterior con nota opcional", async () => {
    axiosSalud.post.mockResolvedValue({ data: correccion("a-1", { estado: "revertida" }) });
    renderizar();
    fireEvent.click((await screen.findAllByRole("button", { name: "Restaurar dato anterior" }))[0]);
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText(/Nota interna/), { target: { value: "No coincide con el legajo" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Restaurar dato anterior" }));
    await waitFor(() =>
      expect(axiosSalud.post).toHaveBeenCalledWith("/gestion/correcciones/a-1/resolucion", { decision: "revertir", nota: "No coincide con el legajo" })
    );
  });

  it("un empleado sin rol revisor no ve la bandeja", () => {
    useSaludStore.setState({ roles: ["EMPLEADO"] });
    renderizar();
    expect(screen.getByText("No tenés permiso para revisar correcciones.")).toBeInTheDocument();
  });
});
