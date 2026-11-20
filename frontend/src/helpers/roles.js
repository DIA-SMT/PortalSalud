// Roles que revisan correcciones de fichas (el backend aplica el permiso real y el ámbito).
export const ROLES_REVISORES = ["RECURSOS_HUMANOS", "CAPITAL_HUMANO_SALUD", "PROFESIONAL_SALUD"];
// Roles que consultan el padrón de empleados.
export const ROLES_PADRON = ["RECURSOS_HUMANOS", "CAPITAL_HUMANO_SALUD", "COORDINADOR_SALUD"];

export const esRevisor = (roles = []) => roles.some((r) => ROLES_REVISORES.includes(r));
export const veePadron = (roles = []) => roles.some((r) => ROLES_PADRON.includes(r));
// Importar requiere además alcance global; si no lo tiene, el backend responde 403.
export const puedeImportarPadron = (roles = []) => roles.includes("RECURSOS_HUMANOS");

// Roles que gestionan la agenda de controles (el backend aplica el ámbito por repartición).
export const ROLES_AGENDA = ["PROFESIONAL_SALUD", "COORDINADOR_SALUD"];
export const gestionaAgenda = (roles = []) => roles.some((r) => ROLES_AGENDA.includes(r));
