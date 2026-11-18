import axiosSalud, { mensajeDeError } from "../config/axiosSalud";

// Mismos tipos y reglas que valida el backend.
export const TIPOS_DOCUMENTO = {
  constancia: { texto: "Constancia", clasificacion: "administrativo", ayuda: "Turnos, asistencia u otras constancias administrativas." },
  certificado: { texto: "Certificado médico", clasificacion: "clinico", ayuda: "Certificados emitidos por un profesional." },
  estudio: { texto: "Estudio", clasificacion: "clinico", ayuda: "Resultados de laboratorio, imágenes u otros estudios." },
  informe: { texto: "Informe", clasificacion: "clinico", ayuda: "Informes médicos." },
};

export const EXTENSIONES = ["pdf", "jpg", "jpeg", "png"];
export const TAMANO_MAXIMO = 5 * 1024 * 1024;

export const validarArchivoLocal = (archivo) => {
  if (!archivo) return "Elegí un archivo.";
  const extension = archivo.name.split(".").pop().toLowerCase();
  if (!EXTENSIONES.includes(extension)) return "Solo se aceptan archivos PDF, JPG o PNG.";
  if (archivo.size > TAMANO_MAXIMO) return "El archivo supera los 5 MB permitidos.";
  if (archivo.size === 0) return "El archivo está vacío.";
  return "";
};

export const formatearTamano = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// FileReader funciona en todos los navegadores (y en jsdom, donde Blob.text() no existe).
const leerTexto = (blob) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsText(blob);
  });

// Descarga con la sesión (cookie) y dispara el guardado en el navegador.
export async function descargarDocumento(documento) {
  try {
    const { data } = await axiosSalud.get(`/salud/documentos/${documento.id}/descarga`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = documento.nombreOriginal || "documento";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    // Con responseType blob, el mensaje de error del backend viene como Blob.
    let mensaje = mensajeDeError(error);
    const cuerpo = error?.response?.data;
    if (cuerpo instanceof Blob) {
      try {
        mensaje = JSON.parse(await leerTexto(cuerpo)).message || mensaje;
      } catch {
        // el cuerpo no era JSON: queda el mensaje genérico
      }
    }
    throw new Error(mensaje);
  }
}
