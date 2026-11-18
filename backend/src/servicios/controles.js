const CustomError = require("../utils/CustomError");
const { fechaISO, aISO } = require("../utils/fechas");
const { estadoEfectivo } = require("./resumen");

const MS_DIA = 86400000;
const AGENDADOS = ["programado", "reprogramado"];

// Controles médicos del titular. Son datos administrativos (agenda): tipo, fechas,
// estado, lugar y responsable. Nunca resultados ni diagnósticos.
function crearServicioControles({ admin }, { reprogramacionDiasMinimos = 2 } = {}) {
  // Se puede pedir reprogramar un control agendado con suficiente anticipación
  // y sin otra solicitud pendiente.
  const fechaMinimaReprogramacion = (ahora) => fechaISO(new Date(ahora.getTime() + reprogramacionDiasMinimos * MS_DIA));
  const puedeReprogramar = (c, solicitud, ahora) =>
    AGENDADOS.includes(c.estado) &&
    Boolean(c.fecha_programada) &&
    c.fecha_programada >= fechaMinimaReprogramacion(ahora) &&
    solicitud?.estado !== "pendiente";

  const mapearSolicitud = (s) =>
    s ? { id: s.id, estado: s.estado, motivo: s.motivo, creadoEn: aISO(s.creado_en), resueltoEn: aISO(s.resuelto_en) } : null;

  const mapear = (c, ahora, documentos = [], solicitud = null) => ({
    id: c.id,
    tipo: c.tipo_control,
    fechaProgramada: c.fecha_programada,
    fechaRealizacion: c.fecha_realizacion,
    estado: estadoEfectivo(c, fechaISO(ahora)),
    lugar: c.lugar,
    responsable: c.responsable,
    proximaRevision: c.proxima_revision,
    documentos,
    solicitudReprogramacion: mapearSolicitud(solicitud),
    puedeSolicitarReprogramacion: puedeReprogramar(c, solicitud, ahora),
  });

  // Solo documentos administrativos (constancias, turnos) asociados al control.
  const documentosPorControl = async (idPersona, idsControles) => {
    if (!idsControles.length) return new Map();
    const filas = await admin("documento_salud")
      .where({ id_persona: idPersona })
      .whereIn("id_control", idsControles)
      .select("id", "id_control", "tipo", "titulo", "estado_validacion")
      .orderBy("creado_en", "desc");
    const mapa = new Map();
    for (const d of filas) {
      const lista = mapa.get(d.id_control) || [];
      lista.push({ id: `a-${d.id}`, tipo: d.tipo, titulo: d.titulo, estadoValidacion: d.estado_validacion });
      mapa.set(d.id_control, lista);
    }
    return mapa;
  };

  // Última solicitud de reprogramación de cada control.
  const solicitudesPorControl = async (idPersona, idsControles) => {
    if (!idsControles.length) return new Map();
    const filas = await admin("solicitud_reprogramacion")
      .where({ id_persona: idPersona })
      .whereIn("id_control", idsControles)
      .orderBy("creado_en", "asc")
      .orderBy("id", "asc");
    return new Map(filas.map((s) => [s.id_control, s]));
  };

  const listar = async (idPersona, ahora = new Date()) => {
    const controles = await admin("control_medico").where({ id_persona: idPersona });
    const ids = controles.map((c) => c.id);
    const [docs, solicitudes] = await Promise.all([
      documentosPorControl(idPersona, ids),
      solicitudesPorControl(idPersona, ids),
    ]);
    const fechaOrden = (c) => c.fechaProgramada || c.fechaRealizacion || "9999-12-31";
    return controles
      .map((c) => mapear(c, ahora, docs.get(c.id) || [], solicitudes.get(c.id)))
      .sort((a, b) => fechaOrden(a).localeCompare(fechaOrden(b)) || a.id - b.id);
  };

  const obtener = async (idPersona, id, ahora = new Date()) => {
    const fila = await admin("control_medico").where({ id, id_persona: idPersona }).first();
    if (!fila) throw new CustomError("Control no encontrado", 404);
    const [docs, solicitudes] = await Promise.all([
      documentosPorControl(idPersona, [fila.id]),
      solicitudesPorControl(idPersona, [fila.id]),
    ]);
    return mapear(fila, ahora, docs.get(fila.id) || [], solicitudes.get(fila.id));
  };

  // El empleado pide una nueva fecha; el servicio de salud la resuelve (panel, Etapa 2).
  const solicitarReprogramacion = async (idPersona, id, motivo, ahora = new Date()) => {
    const control = await admin("control_medico").where({ id, id_persona: idPersona }).first();
    if (!control) throw new CustomError("Control no encontrado", 404);
    const previa = (await solicitudesPorControl(idPersona, [id])).get(control.id);

    if (previa?.estado === "pendiente") {
      throw new CustomError("Ya pediste reprogramar este control. El servicio de salud te va a responder.", 409);
    }
    if (!AGENDADOS.includes(control.estado) || !control.fecha_programada) {
      throw new CustomError("Este control no se puede reprogramar.", 409);
    }
    if (control.fecha_programada < fechaMinimaReprogramacion(ahora)) {
      throw new CustomError(
        `Faltan menos de ${reprogramacionDiasMinimos} días para el control: comunicate directamente con el servicio de salud.`,
        409
      );
    }

    await admin("solicitud_reprogramacion").insert({
      id_control: control.id,
      id_persona: idPersona,
      motivo: motivo.trim(),
      estado: "pendiente",
      creado_en: ahora,
    });
    return obtener(idPersona, id, ahora);
  };

  return { listar, obtener, solicitarReprogramacion };
}

module.exports = { crearServicioControles };
