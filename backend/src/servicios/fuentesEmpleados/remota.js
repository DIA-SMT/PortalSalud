const CustomError = require("../../utils/CustomError");
const { validarLote } = require("./registro");

// Base para fuentes que exponen el padrón por HTTP (CiDiTuc, Portal del Empleado).
// Cada fuente concreta aporta `extraer(cuerpo)` (dónde viene la lista) y
// `mapear(item)` (cómo se llaman sus campos). Todo lo demás es común.
//
// Autenticación servidor a servidor con un token de servicio en un encabezado:
// nunca se usa el token de un usuario ni se expone al navegador.
function crearFuenteRemota({ id, nombre, descripcion, aporta, url, token, timeoutMs = 15000, extraer, mapear }, fetchImpl = fetch) {
  const disponible = Boolean(url);

  const obtener = async () => {
    if (!disponible) {
      throw new CustomError(`La integración con ${nombre} todavía no está habilitada.`, 501);
    }
    let respuesta;
    try {
      respuesta = await fetchImpl(url, {
        headers: { Accept: "application/json", ...(token ? { "X-Token-Servicio": token } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new CustomError(`No pudimos conectarnos con ${nombre}. Intentá más tarde.`, 503);
    }
    if (!respuesta.ok) {
      throw new CustomError(`${nombre} respondió con un error (${respuesta.status}).`, 502);
    }
    const cuerpo = await respuesta.json().catch(() => null);
    const lista = extraer(cuerpo);
    if (!Array.isArray(lista)) {
      throw new CustomError(`La respuesta de ${nombre} no tiene el formato esperado.`, 502);
    }
    return validarLote(lista.map(mapear));
  };

  return { id, nombre, descripcion, aporta, disponible, obtener };
}

// Toma el primer campo presente entre varios nombres posibles.
const primero = (item, ...claves) => {
  for (const c of claves) {
    if (item?.[c] !== undefined && item[c] !== null && item[c] !== "") return item[c];
  }
  return undefined;
};

module.exports = { crearFuenteRemota, primero };
