// Políticas de acceso del portal. Todo lo que no está permitido explícitamente
// está denegado. Las reglas reciben:
//   actor    -> { id_persona, roles: [{ rol, ambito_id_reparticion }] } (de la sesión)
//   contexto -> { id_persona_titular, id_reparticion_titular } (del recurso, nunca del cliente)
//
// Decisiones pendientes de validación legal/organizativa marcadas con [PENDIENTE].

const ROLES = Object.freeze({
  EMPLEADO: "EMPLEADO",
  PROFESIONAL_SALUD: "PROFESIONAL_SALUD",
  COORDINADOR_SALUD: "COORDINADOR_SALUD",
  RECURSOS_HUMANOS: "RECURSOS_HUMANOS",
  // [PENDIENTE: validación legal] Personal de Capital Humano autorizado expresamente a
  // cargar y revisar información de salud. Separado de RECURSOS_HUMANOS para que el
  // resto del área siga sin acceso a datos clínicos.
  CAPITAL_HUMANO_SALUD: "CAPITAL_HUMANO_SALUD",
  ADMINISTRADOR_TECNICO: "ADMINISTRADOR_TECNICO",
});

const esTitular = (actor, ctx) =>
  ctx?.id_persona_titular !== undefined && actor.id_persona === ctx.id_persona_titular;

// Rol vigente cuyo ámbito alcanza a la repartición del titular (ámbito null = todas).
const tieneRolEnAmbito = (actor, rol, ctx) =>
  actor.roles.some(
    (r) =>
      r.rol === rol &&
      (r.ambito_id_reparticion === null ||
        r.ambito_id_reparticion === undefined ||
        r.ambito_id_reparticion === ctx?.id_reparticion_titular)
  );

const tieneRolGlobal = (actor, rol) =>
  actor.roles.some((r) => r.rol === rol && (r.ambito_id_reparticion ?? null) === null);

const tieneRol = (actor, rol) => actor.roles.some((r) => r.rol === rol);

const REGLAS = {
  // Datos propios del empleado (resumen, contactos, controles, recordatorios, preferencias).
  "leer:datos_propios": (a, c) => tieneRol(a, ROLES.EMPLEADO) && esTitular(a, c),
  "editar:datos_propios": (a, c) => tieneRol(a, ROLES.EMPLEADO) && esTitular(a, c),

  // Datos clínicos: titular, profesional de salud y Capital Humano (salud) en su ámbito. Nadie más.
  "leer:datos_clinicos": (a, c) =>
    esTitular(a, c) ||
    tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.CAPITAL_HUMANO_SALUD, c),
  "declarar:datos_clinicos": (a, c) => esTitular(a, c), // corrección del titular, con revisión posterior
  "registrar:datos_clinicos": (a, c) =>
    tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c) || tieneRolEnAmbito(a, ROLES.CAPITAL_HUMANO_SALUD, c),
  "verificar:datos_clinicos": (a, c) => tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c),

  // Padrón de empleados importado desde RRHH.
  "importar:padron": (a) => tieneRolGlobal(a, ROLES.RECURSOS_HUMANOS),
  "leer:padron": (a) =>
    tieneRol(a, ROLES.RECURSOS_HUMANOS) || tieneRol(a, ROLES.CAPITAL_HUMANO_SALUD) || tieneRol(a, ROLES.COORDINADOR_SALUD),

  // Carga de la ficha por Capital Humano y revisión de las correcciones del empleado.
  "cargar:datos_ficha": (a, c) => tieneRolEnAmbito(a, ROLES.RECURSOS_HUMANOS, c),
  "revisar:correcciones_ficha": (a, c) => tieneRolEnAmbito(a, ROLES.RECURSOS_HUMANOS, c),
  "revisar:correcciones_clinicas": (a, c) =>
    tieneRolEnAmbito(a, ROLES.CAPITAL_HUMANO_SALUD, c) || tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c),

  // Agenda de controles (datos administrativos).
  "gestionar:controles": (a, c) =>
    tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c) || tieneRolEnAmbito(a, ROLES.COORDINADOR_SALUD, c),
  "leer:cumplimiento": (a, c) =>
    tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.COORDINADOR_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.RECURSOS_HUMANOS, c),

  // Aptitud laboral: la registra solo un profesional.
  "registrar:aptitud": (a, c) => tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c),
  // [PENDIENTE] Quién ve el resultado (apto / no apto, sin detalle) debe validarlo Asesoría Legal.
  "leer:resultado_aptitud": (a, c) =>
    esTitular(a, c) ||
    tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.COORDINADOR_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.RECURSOS_HUMANOS, c),

  // Validación de documentos administrativos (constancias).
  "validar:documentos_admin": (a, c) =>
    tieneRolEnAmbito(a, ROLES.PROFESIONAL_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.COORDINADOR_SALUD, c) ||
    tieneRolEnAmbito(a, ROLES.RECURSOS_HUMANOS, c),

  // Administración del portal (sin acceso clínico).
  "gestionar:roles": (a) => tieneRolGlobal(a, ROLES.COORDINADOR_SALUD) || tieneRol(a, ROLES.ADMINISTRADOR_TECNICO),
  "leer:auditoria": (a) => tieneRolGlobal(a, ROLES.COORDINADOR_SALUD) || tieneRol(a, ROLES.ADMINISTRADOR_TECNICO),
  "leer:estadisticas": (a) => tieneRol(a, ROLES.COORDINADOR_SALUD) || tieneRol(a, ROLES.RECURSOS_HUMANOS),
};

function puede(actor, accion, recurso, contexto = {}) {
  if (!actor || !Array.isArray(actor.roles)) return false;
  const regla = REGLAS[`${accion}:${recurso}`];
  return regla ? Boolean(regla(actor, contexto)) : false;
}

module.exports = { puede, ROLES, REGLAS };
