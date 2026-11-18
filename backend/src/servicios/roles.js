const { ROLES } = require("../politicas/politicas");

// Roles vigentes de una persona. Se leen en cada petición para que una
// revocación tenga efecto inmediato, sin esperar a que venza la sesión.
async function obtenerRolesVigentes(dbAdmin, idPersona, ahora = new Date()) {
  const filas = await dbAdmin("asignacion_rol_salud")
    .select("rol", "ambito_id_reparticion")
    .where({ id_persona: idPersona })
    .whereNull("revocado_en")
    .where("vigente_desde", "<=", ahora)
    .andWhere((q) => q.whereNull("vigente_hasta").orWhere("vigente_hasta", ">", ahora));

  // Toda persona validada como empleada por CiDiTuc es EMPLEADO para sus propios datos.
  return [{ rol: ROLES.EMPLEADO, ambito_id_reparticion: null }, ...filas];
}

module.exports = { obtenerRolesVigentes };
