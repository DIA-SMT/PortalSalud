import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Padron from "./Padron";
import axiosSalud from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";
import { avisarExito } from "../../helpers/avisos";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn(), post: vi.fn() } };
});
vi.mock("../../helpers/avisos", () => ({ avisarExito: vi.fn(), avisarError: vi.fn() }));

const EMPLEADOS = [
  { legajo: 70020, cuil: "00200700201", apellido: "Pendiente", nombre: "Rosa", reparticion: "Hacienda", activo: true, ingresoAlPortal: false },
  { legajo: 70001, cuil: "00200700015", apellido: "Ficticia", nombre: "Lucía", reparticion: "Hacienda", activo: true, ingresoAlPortal: true },
];
const PREVIA = {
  resumen: { filas: 3, altas: 1, actualizaciones: 1, sinCambios: 0, bajas: 0, errores: 1, conDatosLaborales: 1 },
  errores: [{ linea: 4, legajo: 80002, mensaje: "CUIL inválido" }],
  muestra: [{ linea: 2, legajo: 80001, nombre: "Alta, Uno", tipo: "alta" }],
  confirmado: false,
};

const FUENTES = [
  { id: "csv", nombre: "Archivo CSV de RRHH", disponible: true },
  { id: "portal_empleado", nombre: "Portal del Empleado", descripcion: "Legajo municipal", disponible: true },
  { id: "cidituc", nombre: "Ciudad Digital (CiDiTuc)", descripcion: "Empleados validados", disponible: false },
];

const renderizar = () =>
  render(
    <MemoryRouter>
      <Padron />
    </MemoryRouter>
  );

describe("Padrón de empleados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSaludStore.setState({ roles: ["EMPLEADO", "RECURSOS_HUMANOS"] });
    axiosSalud.get.mockImplementation(async (url) =>
      url === "/gestion/padron/fuentes" ? { data: { fuentes: FUENTES } } : { data: { total: 2, pagina: 1, empleados: EMPLEADOS } }
    );
  });

  it("lista el padrón con el estado de ingreso al portal y el CUIL formateado", async () => {
    renderizar();
    expect(await screen.findByText("Pendiente, Rosa")).toBeInTheDocument();
    expect(screen.getByText("Aún no ingresó")).toBeInTheDocument();
    expect(screen.getByText("Ingresó al portal")).toBeInTheDocument();
    expect(screen.getByText("00-20070020-1")).toBeInTheDocument();
  });

  it("busca mientras se escribe", async () => {
    renderizar();
    await screen.findByText("Pendiente, Rosa");
    fireEvent.change(screen.getByLabelText("Buscar en el padrón"), { target: { value: "rosa" } });
    await waitFor(() => expect(axiosSalud.get).toHaveBeenCalledWith("/gestion/padron?pagina=1&buscar=rosa"));
  });

  it("previsualiza el archivo, muestra errores y recién después confirma", async () => {
    axiosSalud.post.mockResolvedValueOnce({ data: PREVIA }).mockResolvedValueOnce({ data: { ...PREVIA, confirmado: true } });
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Importar padrón" }));
    const dialogo = await screen.findByRole("dialog");
    const archivo = new File(["legajo;cuil"], "padron.csv", { type: "text/csv" });
    fireEvent.change(dialogo.querySelector('input[type="file"]'), { target: { files: [archivo] } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Revisar archivo" }));

    expect(await within(dialogo).findByText("1 altas")).toBeInTheDocument();
    expect(within(dialogo).getByText("CUIL inválido")).toBeInTheDocument();
    expect(axiosSalud.post.mock.calls[0][1].get("confirmar")).toBe("false");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar importación" }));
    await waitFor(() => expect(avisarExito).toHaveBeenCalled());
    expect(axiosSalud.post.mock.calls[1][1].get("confirmar")).toBe("true");
  });

  it("muestra las fuentes y sincroniza desde una remota sin pedir archivo", async () => {
    axiosSalud.post.mockResolvedValueOnce({ data: PREVIA });
    renderizar();
    expect(await screen.findByText("Integración pendiente")).toBeInTheDocument(); // CiDiTuc sin URL
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Sincronizar desde Portal del Empleado")).toBeInTheDocument();
    expect(dialogo.querySelector('input[type="file"]')).toBeNull();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Revisar datos" }));
    await waitFor(() =>
      expect(axiosSalud.post).toHaveBeenCalledWith("/gestion/padron/sincronizaciones", {
        fuente: "portal_empleado",
        confirmar: false,
        padronCompleto: false,
      })
    );
  });

  it("rechaza archivos que no son CSV antes de enviarlos", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Importar padrón" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(dialogo.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "padron.xlsx")] } });
    expect(within(dialogo).getByText(/Elegí un archivo .csv/)).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Revisar archivo" })).toBeDisabled();
  });

  it("Capital Humano (salud) consulta pero no importa; un empleado no accede", () => {
    useSaludStore.setState({ roles: ["EMPLEADO", "CAPITAL_HUMANO_SALUD"] });
    const { unmount } = renderizar();
    expect(screen.queryByRole("button", { name: "Importar padrón" })).not.toBeInTheDocument();
    unmount();
    useSaludStore.setState({ roles: ["EMPLEADO"] });
    renderizar();
    expect(screen.getByText("No tenés permiso para consultar el padrón.")).toBeInTheDocument();
  });
});
