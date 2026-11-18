import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FichaSalud from "./FichaSalud";
import axiosSalud from "../../config/axiosSalud";
import Swal from "../../common/alerta";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("../../helpers/avisos", () => ({ avisarExito: vi.fn(), avisarError: vi.fn() }));
vi.mock("../../common/alerta", () => ({ default: { fire: vi.fn() }, confirmarBorrado: vi.fn() }));

const dato = (valor, estado) => ({ valor, estado });

const FICHA = {
  personales: { nombre: "Lucía", apellido: "Ficticia" },
  contacto: { telefonoAlternativo: dato(null, "sin_datos"), emailAlternativo: dato(null, "sin_datos") },
  contactosEmergencia: [{ id: 1, nombre: "Contacto Ficticio Uno", vinculo: "Hermana", telefono: "0381-000-0001", prioridad: 1 }],
  laboral: {
    legajo: 70001,
    reparticion: "Hacienda (ficticia)",
    area: dato("Presupuesto", "capital_humano"),
    puesto: dato("Analista", "pendiente_revision"),
    actividad: dato(null, "sin_datos"),
    riesgos: [],
  },
};

const SALUD = {
  grupoSanguineo: dato("0+", "capital_humano"),
  cobertura: dato("Obra social ficticia", "revisado"),
  declaraciones: [
    { id: 10, categoria: "alergia", descripcion: "Alergia ficticia", origen: "capital_humano", estado: "capital_humano" },
    { id: 11, categoria: "condicion", descripcion: "Condición registrada", origen: "servicio_salud", estado: "servicio_salud" },
  ],
};

const renderizar = (url = "/salud/ficha") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FichaSalud />
    </MemoryRouter>
  );

describe("FichaSalud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosSalud.get.mockImplementation(async (url) => {
      if (url === "/salud/ficha") return { data: structuredClone(FICHA) };
      if (url === "/salud/ficha/salud") return { data: structuredClone(SALUD) };
      if (url === "/salud/documentos") return { data: { documentos: [] } };
      throw new Error(`URL inesperada ${url}`);
    });
  });

  it("muestra datos personales, contactos de emergencia y el aviso de Capital Humano", async () => {
    renderizar();
    expect(await screen.findByText("Contacto Ficticio Uno")).toBeInTheDocument();
    expect(screen.getByText("Lucía")).toBeInTheDocument();
    expect(screen.getByText(/Tus datos los carga Capital Humano/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Datos personales" })).toHaveAttribute("aria-selected", "true");
    // Lo clínico no se pide hasta abrir la pestaña.
    expect(axiosSalud.get).not.toHaveBeenCalledWith("/salud/ficha/salud");
  });

  it("valida el contacto de emergencia antes de enviarlo", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Agregar" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText(/Nombre y apellido/), { target: { value: "A" } });
    fireEvent.change(within(dialogo).getByLabelText(/^Teléfono\s*\*?$/), { target: { value: "abc" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    expect(await within(dialogo).findByText("Nombre: escribí al menos 2 caracteres")).toBeInTheDocument();
    expect(within(dialogo).getByText(/Usá solo números/)).toBeInTheDocument();
    expect(axiosSalud.post).not.toHaveBeenCalled();
  });

  it("muestra quién cargó cada dato de salud y permite corregirlos todos", async () => {
    renderizar("/salud/ficha?seccion=salud");
    expect(await screen.findByText("Alergia ficticia")).toBeInTheDocument();
    expect(screen.getAllByText("Cargado por Capital Humano").length).toBeGreaterThan(0);
    expect(screen.getByText("Registrado por el servicio de salud")).toBeInTheDocument();
    expect(screen.getByText("Revisado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corregir alergia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corregir condición" })).toBeInTheDocument();
  });

  it("pide confirmación antes de corregir un dato cargado por el área", async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });
    axiosSalud.put.mockResolvedValue({ data: { ...FICHA.laboral, area: dato("Contaduría", "pendiente_revision") } });
    renderizar("/salud/ficha?seccion=laboral");

    const area = await screen.findByLabelText("Área");
    expect(screen.getByText("Modificado por vos · pendiente de revisión")).toBeInTheDocument();
    const guardar = screen.getByRole("button", { name: "Guardar cambios" });
    expect(guardar).toBeDisabled();

    fireEvent.change(area, { target: { value: "Contaduría" } });
    fireEvent.click(guardar);
    await waitFor(() => expect(axiosSalud.put).toHaveBeenCalledWith("/salud/ficha/laboral", { area: "Contaduría" }));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: "¿Corregir datos cargados por el área?" }));
    expect(await screen.findAllByText("Modificado por vos · pendiente de revisión")).toHaveLength(2);
  });

  it("no guarda si se cancela la confirmación", async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false });
    renderizar("/salud/ficha?seccion=laboral");
    fireEvent.change(await screen.findByLabelText("Área"), { target: { value: "Otra área" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
    expect(axiosSalud.put).not.toHaveBeenCalled();
  });
});
