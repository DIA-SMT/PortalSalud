const { fechaISO, aISO } = require("../utils/fechas");

const ESTADOS_AGENDADOS = ["programado", "reprogramado"];

// Un control agendado cuya fecha ya pasó se muestra como "vencido" aunque nadie
// lo haya actualizado. Es un estado administrativo, no una evaluación clínica.
const estadoEfectivo = (control, hoy) =>
  ESTADOS_AGENDADOS.includes(control.estado) && control.fecha_programada && control.fecha_programada < hoy
    ? "vencido"
    : control.estado;

const mapearControl = (c, hoy) => ({
  id: c.id,
  tipo: c.tipo_control,
  fechaProgramada: c.fecha_programada,
  fechaRealizacion: c.fecha_realizacion,
  estado: estadoEfectivo(c, hoy),
  lugar: c.lugar,
  responsable: c.responsable,
});

const contarPorEstado = (filas) =>
  filas.reduce(
    (acc, { estado_validacion: estado, cantidad }) => ({ ...acc, [estado]: Number(cantidad) }),
    { pendiente: 0, validado: 0, rechazado: 0 }
  );

// Resumen del dashboard "Mi Salud". Solo datos del titular, y del esquema clínico
// únicamente existencia y cantidades (nunca contenido).
async function obtenerResumen({ admin, clinica }, idPersona, ahora = new Date()) {
  const hoy = fechaISO(ahora);

  const [
    controles,
    recordatorios,
    docsAdmin,
    docsClinicos,
    cantContactos,
    datosContacto,
    preferencias,
    ficha,
    cantDeclaraciones,
  ] = await Promise.all([
    admin("control_medico").where({ id_persona: idPersona }).orderBy("fecha_programada", "asc"),
    admin("recordatorio")
      .where({ id_persona: idPersona })
      .whereNull("leido_en")
      .where("programado_para", "<=", ahora)
      .orderBy("programado_para", "desc")
      .limit(5),
    admin("documento_salud")
      .where({ id_persona: idPersona })
      .select("estado_validacion")
      .count({ cantidad: "*" })
      .groupBy("estado_validacion"),
    clinica("documento_clinico")
      .where({ id_persona: idPersona })
      .select("estado_validacion")
      .count({ cantidad: "*" })
      .groupBy("estado_validacion"),
    admin("contacto_emergencia").where({ id_persona: idPersona }).count({ cantidad: "*" }).first(),
    admin("datos_contacto").where({ id_persona: idPersona }).first(),
    admin("preferencia_notificacion").where({ id_persona: idPersona }).first(),
    clinica("ficha_salud").where({ id_persona: idPersona }).first("id_persona"),
    clinica("declaracion_salud").where({ id_persona: idPersona, vigente: true }).count({ cantidad: "*" }).first(),
  ]);

  const mapeados = controles.map((c) => mapearControl(c, hoy));
  const proximoControl =
    mapeados.find((c) => ESTADOS_AGENDADOS.includes(c.estado) && c.fechaProgramada >= hoy) || null;
  const pendientes = mapeados.filter((c) => ["pendiente", "vencido"].includes(c.estado));
  const ultimosRealizados = mapeados
    .filter((c) => c.estado === "realizado")
    .sort((a, b) => String(b.fechaRealizacion).localeCompare(String(a.fechaRealizacion)))
    .slice(0, 3);

  const items = [
    {
      clave: "contactos_emergencia",
      etiqueta: "Contacto de emergencia",
      completo: Number(cantContactos?.cantidad || 0) > 0,
    },
    {
      clave: "datos_contacto",
      etiqueta: "Medios de contacto",
      completo: Boolean(datosContacto?.telefono_alternativo || datosContacto?.email_alternativo),
    },
    {
      clave: "informacion_salud",
      etiqueta: "Información de salud",
      completo: Boolean(ficha) || Number(cantDeclaraciones?.cantidad || 0) > 0,
    },
    {
      clave: "preferencias",
      etiqueta: "Preferencias de recordatorios",
      completo: Boolean(preferencias),
    },
  ];
  const completos = items.filter((i) => i.completo).length;

  const admDocs = contarPorEstado(docsAdmin);
  const cliDocs = contarPorEstado(docsClinicos);

  return {
    proximoControl,
    controlesPendientes: { cantidad: pendientes.length, items: pendientes.slice(0, 3) },
    ultimosControles: ultimosRealizados,
    documentos: {
      disponibles: admDocs.validado + cliDocs.validado,
      pendientesValidacion: admDocs.pendiente + cliDocs.pendiente,
    },
    recordatorios: recordatorios.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      titulo: r.titulo,
      mensaje: r.mensaje,
      programadoPara: aISO(r.programado_para),
    })),
    completitud: { porcentaje: Math.round((completos / items.length) * 100), items },
  };
}

module.exports = { obtenerResumen, estadoEfectivo };
