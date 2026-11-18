const CustomError = require("../../utils/CustomError");
const { crearFuenteCidituc } = require("./cidituc");
const { crearFuentePortalEmpleado } = require("./portalEmpleado");

// Registro de fuentes de datos de empleados. El CSV se maneja aparte (se sube un archivo);
// las remotas se sincronizan desde el servidor cuando tienen URL configurada.
//
// Para sumar una fuente nueva: crear un adaptador con crearFuenteRemota (o uno propio que
// devuelva { registros, errores, totalFilas } con el registro normalizado) y agregarlo acá.
function crearFuentesEmpleados(config = {}, fetchImpl) {
  const remotas = [
    crearFuentePortalEmpleado(config.portalEmpleado, fetchImpl),
    crearFuenteCidituc(config.cidituc, fetchImpl),
  ];
  const porId = new Map(remotas.map((f) => [f.id, f]));

  return {
    listar: () => [
      {
        id: "csv",
        nombre: "Archivo CSV de RRHH",
        descripcion: "Importación manual mientras no esté habilitada una integración.",
        aporta: ["identificacion", "reparticion", "laborales"],
        disponible: true,
      },
      ...remotas.map(({ id, nombre, descripcion, aporta, disponible }) => ({ id, nombre, descripcion, aporta, disponible })),
    ],
    obtener: (id) => {
      const fuente = porId.get(id);
      if (!fuente) throw new CustomError("Fuente de datos desconocida.", 400);
      return fuente;
    },
  };
}

// Origen con el que se marcan los datos laborales según la fuente. Lo que sube
// Capital Humano por CSV se muestra como "Cargado por Capital Humano".
const origenDeFuente = (idFuente) => (idFuente === "csv" ? "capital_humano" : idFuente);

module.exports = { crearFuentesEmpleados, origenDeFuente };
