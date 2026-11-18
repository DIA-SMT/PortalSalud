const CustomError = require("../utils/CustomError");

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

// Tipos permitidos, reconocidos por su firma (magic bytes), no por la extensión
// ni por el Content-Type que manda el navegador.
const TIPOS = [
  { mime: "application/pdf", extensiones: ["pdf"], firma: Buffer.from("%PDF-") },
  { mime: "image/jpeg", extensiones: ["jpg", "jpeg"], firma: Buffer.from([0xff, 0xd8, 0xff]) },
  { mime: "image/png", extensiones: ["png"], firma: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
];

// Contenido activo que no se acepta en PDFs: scripts, ejecución de programas y adjuntos.
// (/OpenAction y /AA no se rechazan solos: los usan muchos PDFs legítimos para fijar
// la vista inicial; si llevan un script, lo detecta /JS.)
// [PENDIENTE] Sumar análisis antivirus cuando la infraestructura del piloto lo provea.
const PDF_PROHIBIDO = [/\/JavaScript\b/, /\/JS\b/, /\/Launch\b/, /\/EmbeddedFile\b/];

const nombreSeguro = (nombre = "") =>
  baseNombre(nombre)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .slice(0, 120) || "documento";

function baseNombre(nombre) {
  return String(nombre).split(/[\\/]/).pop();
}

// Valida tipo, tamaño y contenido. Devuelve el mime detectado y un nombre limpio.
function validarArchivo(archivo) {
  if (!archivo || !Buffer.isBuffer(archivo.buffer) || archivo.buffer.length === 0) {
    throw new CustomError("Elegí un archivo para subir.", 400);
  }
  if (archivo.buffer.length > TAMANO_MAXIMO) {
    throw new CustomError("El archivo supera los 5 MB permitidos.", 413);
  }

  const tipo = TIPOS.find((t) => archivo.buffer.subarray(0, t.firma.length).equals(t.firma));
  if (!tipo) throw new CustomError("Solo se aceptan archivos PDF, JPG o PNG.", 415);

  const nombre = nombreSeguro(archivo.originalname);
  const extension = nombre.includes(".") ? nombre.split(".").pop().toLowerCase() : "";
  if (!tipo.extensiones.includes(extension)) {
    throw new CustomError("La extensión del archivo no coincide con su contenido.", 415);
  }

  if (tipo.mime === "application/pdf") {
    const texto = archivo.buffer.toString("latin1");
    if (PDF_PROHIBIDO.some((patron) => patron.test(texto))) {
      throw new CustomError("El PDF contiene elementos activos (scripts o adjuntos) y no se puede aceptar.", 415);
    }
  }

  return { mime: tipo.mime, nombre, tamano: archivo.buffer.length };
}

module.exports = { validarArchivo, nombreSeguro, TAMANO_MAXIMO };
