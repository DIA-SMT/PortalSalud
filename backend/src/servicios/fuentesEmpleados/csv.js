const CustomError = require("../../utils/CustomError");
const { leerCsv } = require("../../utils/csv");
const { sinTildes } = require("../../utils/texto");
const { validarLote } = require("./registro");

const TAMANO_MAXIMO = 2 * 1024 * 1024;
const FILAS_MAXIMAS = 20000;

// Columnas del CSV de RRHH. Se aceptan variantes de nombre (con o sin tilde, etc.).
const COLUMNAS = {
  legajo: { requerida: true, alias: ["legajo", "nro_legajo", "numero_legajo"] },
  cuil: { requerida: true, alias: ["cuil", "cuit"] },
  apellido: { requerida: true, alias: ["apellido", "apellidos"] },
  nombre: { requerida: true, alias: ["nombre", "nombres"] },
  reparticion: { requerida: false, alias: ["reparticion", "dependencia"] },
  id_reparticion: { requerida: false, alias: ["id_reparticion", "codigo_reparticion"] },
  area: { requerida: false, alias: ["area"] },
  puesto: { requerida: false, alias: ["puesto", "cargo"] },
  actividad: { requerida: false, alias: ["actividad", "actividad_laboral", "tareas"] },
};

const PLANTILLA = [
  "legajo;cuil;apellido;nombre;reparticion;id_reparticion;area;puesto;actividad",
  "70101;00100000008;Ejemplo;Ana;Secretaría de Hacienda;9101;Dirección de Presupuesto;Analista;Tareas administrativas de oficina",
  "70102;00100000016;Prueba;Juan;Secretaría de Obras Públicas;9102;Mantenimiento vial;Operario;Bacheo en vía pública",
].join("\r\n");

const normalizarEncabezado = (t) => sinTildes(t).trim().toLowerCase().replace(/[\s.-]+/g, "_");

// Excel en Windows suele exportar en ANSI (cp1252): si no es UTF-8 válido, se lee como latin1.
const decodificar = (buffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return buffer.toString("latin1");
  }
};

// Fuente "csv": archivo exportado por RRHH y subido por Capital Humano.
// Convierte cada fila al registro normalizado (ver registro.js).
function analizarArchivoCsv(buffer) {
  if (!buffer?.length) throw new CustomError("Elegí el archivo CSV del padrón.", 400);
  if (buffer.length > TAMANO_MAXIMO) throw new CustomError("El archivo supera los 2 MB permitidos.", 413);

  const { filas } = leerCsv(decodificar(buffer));
  if (filas.length < 2) throw new CustomError("El archivo no tiene filas para importar.", 400);
  if (filas.length - 1 > FILAS_MAXIMAS) throw new CustomError(`El archivo supera las ${FILAS_MAXIMAS} filas.`, 413);

  const encabezados = filas[0].valores.map(normalizarEncabezado);
  const indices = {};
  for (const [clave, def] of Object.entries(COLUMNAS)) {
    const i = encabezados.findIndex((e) => def.alias.includes(e));
    if (i >= 0) indices[clave] = i;
  }
  const faltantes = Object.entries(COLUMNAS)
    .filter(([clave, def]) => def.requerida && indices[clave] === undefined)
    .map(([clave]) => clave);
  if (faltantes.length) {
    throw new CustomError(`Faltan columnas obligatorias: ${faltantes.join(", ")}. Descargá la plantilla para ver el formato.`, 400);
  }

  const datos = filas.slice(1);
  const crudos = datos.map(({ valores }) =>
    Object.fromEntries(Object.entries(indices).map(([clave, i]) => [clave, valores[i]]))
  );
  return validarLote(crudos, (i) => datos[i].linea);
}

module.exports = { analizarArchivoCsv, PLANTILLA, COLUMNAS };
