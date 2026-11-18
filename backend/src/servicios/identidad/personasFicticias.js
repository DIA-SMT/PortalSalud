// Personas FICTICIAS para desarrollo y pruebas. Ningún dato corresponde a personas reales.
// Los ids empiezan en 900000 para no colisionar con ids reales de CiDiTuc,
// los CUIL tienen prefijo 00 (inválido) y los correos usan el dominio reservado .test.
// La forma de cada registro imita la respuesta de GET /usuarios/authStatusIA.

const REPARTICIONES = {
  HACIENDA: { id_reparticion: 9101, nombre_reparticion: "Secretaría de Hacienda (ficticia)" },
  OBRAS: { id_reparticion: 9102, nombre_reparticion: "Secretaría de Obras Públicas (ficticia)" },
  SALUD: { id_reparticion: 9103, nombre_reparticion: "Dirección de Salud Laboral (ficticia)" },
  RRHH: { id_reparticion: 9104, nombre_reparticion: "Dirección de Recursos Humanos (ficticia)" },
};

const PERSONAS_FICTICIAS = [
  {
    id_persona: 900001,
    nombre_persona: "Lucía",
    apellido_persona: "Ficticia",
    email_persona: "lucia.ficticia@ejemplo.test",
    afiliado: 70001,
    ...REPARTICIONES.HACIENDA,
    descripcion: "Empleada (solo rol EMPLEADO)",
  },
  {
    id_persona: 900002,
    nombre_persona: "Martín",
    apellido_persona: "Prueba",
    email_persona: "martin.prueba@ejemplo.test",
    afiliado: 70002,
    ...REPARTICIONES.OBRAS,
    descripcion: "Empleado (solo rol EMPLEADO)",
  },
  {
    id_persona: 900003,
    nombre_persona: "Valeria",
    apellido_persona: "Demo",
    email_persona: "valeria.demo@ejemplo.test",
    afiliado: 70003,
    ...REPARTICIONES.SALUD,
    descripcion: "Profesional de salud (ámbito: Obras Públicas)",
  },
  {
    id_persona: 900004,
    nombre_persona: "Diego",
    apellido_persona: "Ejemplo",
    email_persona: "diego.ejemplo@ejemplo.test",
    afiliado: 70004,
    ...REPARTICIONES.SALUD,
    descripcion: "Coordinador de salud (todas las reparticiones)",
  },
  {
    id_persona: 900005,
    nombre_persona: "Carla",
    apellido_persona: "Muestra",
    email_persona: "carla.muestra@ejemplo.test",
    afiliado: 70005,
    ...REPARTICIONES.RRHH,
    descripcion: "Capital Humano · datos personales y laborales (todas las reparticiones)",
  },
  {
    id_persona: 900006,
    nombre_persona: "Tomás",
    apellido_persona: "Simulado",
    email_persona: "tomas.simulado@ejemplo.test",
    afiliado: 70006,
    ...REPARTICIONES.RRHH,
    descripcion: "Administrador técnico (sin acceso clínico)",
  },
  {
    id_persona: 900007,
    nombre_persona: "Paula",
    apellido_persona: "Reserva",
    email_persona: "paula.reserva@ejemplo.test",
    afiliado: 70007,
    ...REPARTICIONES.RRHH,
    descripcion: "Capital Humano · carga y revisión de información de salud",
  },
  {
    id_persona: 900008,
    nombre_persona: "Rosa",
    apellido_persona: "Pendiente",
    email_persona: "rosa.pendiente@ejemplo.test",
    afiliado: 70020,
    ...REPARTICIONES.HACIENDA,
    descripcion: "Empleada en el padrón que todavía no ingresó: su ficha la cargó Capital Humano",
  },
  {
    id_persona: 900099,
    nombre_persona: "Vecino",
    apellido_persona: "NoEmpleado",
    email_persona: "vecino@ejemplo.test",
    noEsEmpleado: true,
    descripcion: "Usuario de CiDiTuc que no es empleado (acceso denegado)",
  },
].map((p, i) => ({ ...p, documento_persona: Number(`00${String(10000000 + i).padStart(8, "0")}9`) }));

module.exports = { PERSONAS_FICTICIAS, REPARTICIONES };
