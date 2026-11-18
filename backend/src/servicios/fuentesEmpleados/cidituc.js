const { crearFuenteRemota, primero } = require("./remota");

// Fuente "cidituc": empleados que CiDiTuc ya tiene registrados (tablas persona,
// empleado y reparticion de su base MySQL).
//
// [PENDIENTE DE INTEGRACIÓN] CiDiTuc no expone hoy un listado de empleados para otros
// sistemas. Este adaptador espera un endpoint de servicio (a acordar con su equipo) que
// devuelva filas con los mismos nombres de columna que usa su backend, por ejemplo el
// resultado de:
//   SELECT e.afiliado, e.id_reparticion, e.habilita, p.documento_persona,
//          p.apellido_persona, p.nombre_persona, r.nombre_reparticion
//   FROM empleado e JOIN persona p ON p.id_persona = e.id_persona
//   LEFT JOIN reparticion r ON r.id_reparticion = e.id_reparticion
// Respuesta aceptada: un arreglo, o { empleados: [...] } / { data: [...] }.
const mapearEmpleadoCidituc = (item) => ({
  legajo: primero(item, "afiliado", "legajo"),
  cuil: primero(item, "documento_persona", "cuil"),
  apellido: primero(item, "apellido_persona", "apellido"),
  nombre: primero(item, "nombre_persona", "nombre"),
  id_reparticion: primero(item, "id_reparticion"),
  reparticion: primero(item, "nombre_reparticion", "reparticion"),
  // CiDiTuc no guarda área, puesto ni actividad: esos datos vienen de otra fuente.
});

const extraerLista = (cuerpo) => (Array.isArray(cuerpo) ? cuerpo : cuerpo?.empleados ?? cuerpo?.data);

const crearFuenteCidituc = (config = {}, fetchImpl) =>
  crearFuenteRemota(
    {
      id: "cidituc",
      nombre: "Ciudad Digital (CiDiTuc)",
      descripcion: "Empleados validados en CiDiTuc: legajo, CUIL, nombre y repartición.",
      aporta: ["identificacion", "reparticion"],
      url: config.url,
      token: config.token,
      timeoutMs: config.timeoutMs,
      extraer: extraerLista,
      mapear: mapearEmpleadoCidituc,
    },
    fetchImpl
  );

module.exports = { crearFuenteCidituc, mapearEmpleadoCidituc, extraerLista };
