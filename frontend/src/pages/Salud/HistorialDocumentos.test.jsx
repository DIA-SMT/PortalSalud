import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistorialDocumentos from "./HistorialDocumentos";
import axiosSalud from "../../config/axiosSalud";
import { avisarError, avisarExito } from "../../helpers/avisos";

vi.mock("../../config/axiosSalud", async (original) => {
  const real = await original();
  return { ...real, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});
vi.mock("../../helpers/avisos", () => ({ avisarExito: vi.fn(), avisarError: vi.fn() }));

const ahora = new Date().toISOString();
const doc = (id, extra) => ({
  id, clasificacion: "administrativo", tipo: "constancia", titulo: `Documento ${id}`, nombreOriginal: `${id}.pdf`,
  mime: "application/pdf", tamano: 2048, estadoValidacion: "validado", subidoPorTitular: false, idControl: null,
  eliminable: false, creadoEn: ahora, ...extra,
});
const DOCUMENTOS = [
  doc("a-1", { titulo: "Constancia de asistencia" }),
  doc("c-2", { clasificacion: "clinico", tipo: "estudio", titulo: "Estudio de laboratorio" }),
  doc("a-3", { titulo: "Turno presentado", estadoValidacion: "pendiente", subidoPorTitular: true, eliminable: true }),
];
const EVENTOS = [
  { id: "control-1", categoria: "control", fecha: ahora, soloFecha: true, futuro: true, titulo: "Control programado", descripcion: "Examen anual", estado: "programado", idControl: 1, lugar: "Consultorio" },
  { id: "documento-a-1", categoria: "documento", fecha: ahora, soloFecha: false, futuro: false, titulo: "Se agregó un documento", descripcion: "Constancia de asistencia", estado: "validado", responsable: "Servicio de salud" },
];

const renderizar = (url = "/salud/documentos") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <HistorialDocumentos />
    </MemoryRouter>
  );

const archivo = (nombre, tamano = 1000, tipo = "application/pdf") => {
  const f = new File(["x"], nombre, { type: tipo });
  Object.defineProperty(f, "size", { value: tamano });
  return f;
};

describe("HistorialDocumentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosSalud.get.mockImplementation(async (url) => {
      if (url === "/salud/documentos") return { data: { documentos: structuredClone(DOCUMENTOS) } };
      if (url === "/salud/historial") return { data: { eventos: EVENTOS } };
      if (url === "/salud/controles") return { data: { controles: [] } };
      throw { response: { status: 404, data: new Blob([JSON.stringify({ message: "El archivo no está disponible." })]) } };
    });
  });

  it("lista documentos, marca los confidenciales y filtra pendientes", async () => {
    renderizar();
    expect(await screen.findByText("Constancia de asistencia")).toBeInTheDocument();
    expect(screen.getAllByText("Confidencial")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Retirar Turno presentado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar Constancia de asistencia" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pendientes de validación (1)" }));
    expect(screen.getByText("Turno presentado")).toBeInTheDocument();
    expect(screen.queryByText("Constancia de asistencia")).not.toBeInTheDocument();
  });

  it("valida el archivo antes de subirlo", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Subir documento" }));
    const dialogo = await screen.findByRole("dialog");
    const entrada = dialogo.querySelector('input[type="file"]');

    fireEvent.change(entrada, { target: { files: [archivo("programa.exe")] } });
    expect(within(dialogo).getByText("Solo se aceptan archivos PDF, JPG o PNG.")).toBeInTheDocument();

    fireEvent.change(entrada, { target: { files: [archivo("enorme.pdf", 6 * 1024 * 1024)] } });
    expect(within(dialogo).getByText("El archivo supera los 5 MB permitidos.")).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Subir" }));
    expect(axiosSalud.post).not.toHaveBeenCalled();
  });

  it("sube un documento clínico con aviso de confidencialidad", async () => {
    axiosSalud.post.mockResolvedValue({ data: doc("c-9", { clasificacion: "clinico", tipo: "certificado", titulo: "Mi certificado", estadoValidacion: "pendiente", subidoPorTitular: true, eliminable: true }) });
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Subir documento" }));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.mouseDown(within(dialogo).getByRole("combobox", { name: /Tipo de documento/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Certificado médico" }));
    expect(within(dialogo).getByText(/información confidencial/)).toBeInTheDocument();

    fireEvent.change(dialogo.querySelector('input[type="file"]'), { target: { files: [archivo("certificado.pdf")] } });
    expect(within(dialogo).getByLabelText(/Título/)).toHaveValue("certificado");
    fireEvent.change(within(dialogo).getByLabelText(/Título/), { target: { value: "Mi certificado" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Subir" }));

    await waitFor(() => expect(avisarExito).toHaveBeenCalled());
    const [url, datos] = axiosSalud.post.mock.calls[0];
    expect(url).toBe("/salud/documentos");
    expect(datos.get("tipo")).toBe("certificado");
    expect(datos.get("titulo")).toBe("Mi certificado");
    expect(datos.get("archivo").name).toBe("certificado.pdf");
    expect(await screen.findByText("Mi certificado")).toBeInTheDocument();
  });

  it("muestra el mensaje del servidor si la descarga falla", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Descargar Constancia de asistencia" }));
    await waitFor(() => expect(avisarError).toHaveBeenCalledWith("El archivo no está disponible."));
  });

  it("muestra la línea de tiempo con eventos próximos", async () => {
    renderizar("/salud/documentos?vista=historial");
    expect(await screen.findByText("Control programado")).toBeInTheDocument();
    expect(screen.getByText("Próximo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver control" })).toBeInTheDocument();
    expect(screen.getByText(/Servicio de salud/)).toBeInTheDocument();
  });
});
