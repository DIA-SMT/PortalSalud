const { crearFuenteRemota, primero } = require("./remota");
const { extraerLista } = require("./cidituc");

// Fuente "portal_empleado": datos del legajo municipal que hoy usa el Portal del Empleado.
//
// [PENDIENTE DE INTEGRACIÓN] El backend de CiDiTuc consulta el legajo con
// { tarea: "legajo_municipal", cuil } y recibe campos con códigos de la liquidación:
//   lega_12 = legajo · codi_17 = ítem de repartición · calc_12 = habilitado · codi_02 = convenio
// No hay hoy un listado completo ni campos confirmados para área, puesto y actividad.
// Este adaptador acepta esos códigos y nombres alternativos; cuando se acuerde el
// endpoint, alcanza con ajustar `mapearLegajoMunicipal`.
const mapearLegajoMunicipal = (item) => ({
  legajo: primero(item, "lega_12", "legajo"),
  cuil: primero(item, "cuil", "cuit", "nume_cuil"),
  apellido: primero(item, "apellido", "apel_12"),
  nombre: primero(item, "nombre", "nomb_12"),
  reparticion: primero(item, "reparticion", "desc_17", "dependencia"),
  // El ítem de repartición de la liquidación (codi_17) no es el id de CiDiTuc: se deja
  // vacío y se completa en el primer ingreso del empleado (ver padron.vincular).
  id_reparticion: primero(item, "id_reparticion"),
  area: primero(item, "area", "desc_area"),
  puesto: primero(item, "puesto", "cargo", "desc_cargo"),
  actividad: primero(item, "actividad", "funcion", "tareas"),
});

const crearFuentePortalEmpleado = (config = {}, fetchImpl) =>
  crearFuenteRemota(
    {
      id: "portal_empleado",
      nombre: "Portal del Empleado",
      descripcion: "Legajo municipal: datos personales básicos, repartición, área, puesto y actividad.",
      aporta: ["identificacion", "reparticion", "laborales"],
      url: config.url,
      token: config.token,
      timeoutMs: config.timeoutMs,
      extraer: extraerLista,
      mapear: mapearLegajoMunicipal,
    },
    fetchImpl
  );

module.exports = { crearFuentePortalEmpleado, mapearLegajoMunicipal };
