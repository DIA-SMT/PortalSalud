import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Recordatorios from "./Recordatorios";
import axiosSalud from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } };
});
vi.mock("../../helpers/avisos", () => ({ avisarExito: vi.fn(), avisarError: vi.fn() }));

const ahora = new Date().toISOString();
const LISTA = {
  noLeidos: 2,
  recordatorios: [
    { id: 1, tipo: "control", titulo: "Mañana tenés un control", mensaje: "Examen ficticio", idControl: 7, programadoPara: ahora, leidoEn: null },
    { id: 2, tipo: "documentacion", titulo: "Documentación pendiente", mensaje: "Constancia", idControl: null, programadoPara: ahora, leidoEn: null },
    { id: 3, tipo: "general", titulo: "Bienvenida", mensaje: "Hola", idControl: null, programadoPara: ahora, leidoEn: ahora },
  ],
};
const PREFS = {
  configurado: true, diasAnticipacion: 3, opcionesDias: [1, 2, 3, 5, 7], canalApp: true,
  canalEmail: false, canalWhatsapp: false, canalesDisponibles: { email: false, whatsapp: false },
};

const renderizar = () =>
  render(
    <MemoryRouter>
      <Recordatorios />
    </MemoryRouter>
  );

describe("Recordatorios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSaludStore.setState({ noLeidos: 0 });
    axiosSalud.get.mockImplementation(async (url) => ({ data: url === "/salud/recordatorios" ? structuredClone(LISTA) : PREFS }));
  });

  it("muestra los no leídos destacados y actualiza la campana", async () => {
    renderizar();
    expect(await screen.findByText("Mañana tenés un control")).toBeInTheDocument();
    expect(screen.getAllByText("(sin leer)")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Ver control" })).toBeInTheDocument();
    await waitFor(() => expect(useSaludStore.getState().noLeidos).toBe(2));
  });

  it("confirma la lectura de un recordatorio", async () => {
    axiosSalud.post.mockResolvedValue({ data: { ...LISTA.recordatorios[0], leidoEn: ahora } });
    renderizar();
    fireEvent.click((await screen.findAllByRole("button", { name: "Marcar como leído" }))[0]);
    await waitFor(() => expect(useSaludStore.getState().noLeidos).toBe(1));
    expect(axiosSalud.post).toHaveBeenCalledWith("/salud/recordatorios/1/leido");
    expect(screen.getAllByText("(sin leer)")).toHaveLength(1);
  });

  it("marca todos como leídos", async () => {
    axiosSalud.post.mockResolvedValue({ data: { cantidad: 0 } });
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Marcar todos como leídos" }));
    await waitFor(() => expect(useSaludStore.getState().noLeidos).toBe(0));
    expect(screen.queryByText("(sin leer)")).not.toBeInTheDocument();
  });

  it("guarda la anticipación y deja los canales externos deshabilitados", async () => {
    axiosSalud.put.mockResolvedValue({ data: { ...PREFS, diasAnticipacion: 5 } });
    renderizar();
    expect(await screen.findByLabelText("Correo electrónico · próximamente")).toBeDisabled();
    expect(screen.getByLabelText("WhatsApp · próximamente")).toBeDisabled();
    const guardar = screen.getByRole("button", { name: "Guardar preferencias" });
    expect(guardar).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "5 días" }));
    fireEvent.click(guardar);
    await waitFor(() => expect(axiosSalud.put).toHaveBeenCalledWith("/salud/preferencias", { diasAnticipacion: 5 }));
  });
});
