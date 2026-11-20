const CustomError = require("../utils/CustomError");
const { fechaISO, aISO } = require("../utils/fechas");
const { puede, ROLES } = require("../politicas/politicas");
const { estadoEfectivo } = require("./resumen");

const ROLES_AGENDA = [ROLES.PROFESIONAL_SALUD, ROLES.COORDINADOR_SALUD];


// Tipos sugeridos (la agenda acepta texto libre: es un dato administrativo, no un diagnóstico).
const TIPOS_SUGERIDOS = [
  "Examen periódico anual",
  "Examen preocupacional",
  "Examen de riesgo específico",
  "Control de laboratorio",
  "Control de agudeza visual",
  "Audiometría",
  "Evaluación ergonómica del puesto",
  "Actualización de vacunación",
  "Examen de egreso",
];

const FORMATO = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const legible = (fechaIso) => FORMATO.format(new Date(`${fechaIso}T00:00:00Z`));

// Reparticiones que alcanza el actor en la agenda (null = todas, [] = ninguna).
const ambitosAgenda = (actor) => {
  const propios = actor.roles.filter((r) => ROLES_AGENDA.includes(r.rol));
  if (!propios.length) return [];
  if (propios.some((r) => (r.ambito_id_reparticion ?? null) === null)) return null;
  return propios.map((r) => r.ambito_id_reparticion);
};

// Agenda institucional de controles para el personal de salud laboral.
// Solo datos administrativos: tipo, fechas, lugar, responsable y estado.
function crearServicioAgenda({ admin }, { padron }) {
  // id_persona (real o provisorio del padrón) -> datos del empleado y su repartición.
  const empleados = async () => {
    const mapa = new Map();
    for (const p of await admin("padron_empleado").select()) {
      mapa.set(p.id_persona ?? -p.id, {
        legajo: p.legajo,
        nombre: `${p.apellido}, ${p.nombre}`,
        id_reparticion: p.id_reparticion,
        reparticion: p.reparticion,
      });
    }
    // Quien ingresó al portal pero todavía no figura en el padrón.
    for (const e of await admin("empleado_visto").select()) {
      if (!mapa.has(e.id_persona)) {
        mapa.set(e.id_persona, { legajo: e.legajo, nombre: e.persona_nombre, id_reparticion: e.id_reparticion, reparticion: e.reparticion });
      }
    }
    return mapa;
  };

  const exigirAmbito = (actor) => {
    const amb = ambitosAgenda(actor);
    if (amb?.length === 0) throw new CustomError("No tenés permiso para gestionar la agenda de controles.", 403);
    return amb;
  };
  const enAmbito = (amb, empleado) => amb === null || (empleado && amb.includes(empleado.id_reparticion));

  const contexto = (idPersona, empleado) => ({ id_persona_titular: idPersona, id_reparticion_titular: empleado?.id_reparticion ?? null });

  const avisar = (idPersona, titulo, mensaje, idControl, ahora) =>
    admin("recordatorio").insert({
      id_persona: idPersona,
      tipo: "control",
      titulo,
      mensaje,
      id_control: idControl,
      programado_para: ahora,
      creado_en: ahora,
    });

  const mapear = (c, hoy, empleado, solicitud) => ({
    id: c.id,
    tipo: c.tipo_control,
    fechaProgramada: c.fecha_programada,
    fechaRealizacion: c.fecha_realizacion,
    estado: estadoEfectivo(c, hoy),
    lugar: c.lugar,
    responsable: c.responsable,
    proximaRevision: c.proxima_revision,
    empleado: empleado
      ? { legajo: empleado.legajo, nombre: empleado.nombre, reparticion: empleado.reparticion }
      : { legajo: null, nombre: "Empleado sin datos en el padrón", reparticion: null },
    pedidoReprogramacion: solicitud ? { id: solicitud.id, motivo: solicitud.motivo, creadoEn: aISO(solicitud.creado_en) } : null,
  });

  // ---------------- Consulta ----------------

  const listar = async (actor, { desde, hasta, estado, buscar } = {}, ahora = new Date()) => {
    const amb = exigirAmbito(actor);
    const hoy = fechaISO(ahora);
    const mapa = await empleados();

    const q = admin("control_medico");
    if (desde) q.where((w) => w.where("fecha_programada", ">=", desde).orWhereNull("fecha_programada"));
    if (hasta) q.where((w) => w.where("fecha_programada", "<=", hasta).orWhereNull("fecha_programada"));
    const filas = await q.orderBy("fecha_programada", "asc").limit(2000);

    const pendientes = new Map(
      (await admin("solicitud_reprogramacion").where({ estado: "pendiente" })).map((s) => [s.id_control, s])
    );
    const texto = String(buscar || "").trim().toLowerCase();

    const controles = filas
      .filter((c) => enAmbito(amb, mapa.get(c.id_persona)))
      .map((c) => mapear(c, hoy, mapa.get(c.id_persona), pendientes.get(c.id)))
      .filter((c) => !estado || c.estado === estado)
      .filter(
        (c) =>
          !texto ||
          c.empleado.nombre.toLowerCase().includes(texto) ||
          String(c.empleado.legajo ?? "").includes(texto) ||
          c.tipo.toLowerCase().includes(texto)
      );
    return { controles, tiposSugeridos: TIPOS_SUGERIDOS };
  };

  const buscarEmpleados = async (actor, texto) => {
    const amb = exigirAmbito(actor);
    return padron.buscar({ texto, ambitos: amb, porPagina: 10 });
  };

  // ---------------- Altas y cambios ----------------

  const controlGestionable = async (actor, id) => {
    exigirAmbito(actor);
    const c = await admin("control_medico").where({ id }).first();
    const empleado = c && (await empleados()).get(c.id_persona);
    // Fuera del ámbito se comporta como inexistente.
    if (!c || !puede(actor, "gestionar", "controles", contexto(c.id_persona, empleado))) {
      throw new CustomError("Control no encontrado", 404);
    }
    return { c, empleado };
  };

  const crear = async (actor, datos, ahora = new Date()) => {
    exigirAmbito(actor);
    const { idPersona, fila } = await padron.resolverLegajo(datos.legajo);
    if (!fila.activo) throw new CustomError("El empleado figura como inactivo en el padrón.", 409);
    if (!puede(actor, "gestionar", "controles", contexto(idPersona, fila))) {
      throw new CustomError("El empleado no pertenece a tu ámbito.", 403);
    }
    if (datos.fechaProgramada && datos.fechaProgramada < fechaISO(ahora)) {
      throw new CustomError("La fecha del control no puede ser anterior a hoy.", 400);
    }
    const [id] = await admin("control_medico")
      .insert({
        id_persona: idPersona,
        tipo_control: datos.tipo.trim(),
        fecha_programada: datos.fechaProgramada || null,
        estado: datos.fechaProgramada ? "programado" : "pendiente",
        lugar: datos.lugar?.trim() || null,
        responsable: datos.responsable?.trim() || null,
        creado_por: actor.id_persona,
        creado_en: ahora,
        actualizado_en: ahora,
      })
      .returning("id")
      .then((r) => r.map((x) => (typeof x === "object" ? x.id : x)));

    if (datos.fechaProgramada) {
      await avisar(
        idPersona,
        "Tenés un nuevo control programado",
        `${datos.tipo.trim()} · ${legible(datos.fechaProgramada)} · ${datos.lugar?.trim() || "lugar a confirmar"}.`,
        id,
        ahora
      );
    }
    return { id, idPersona };
  };

  // Cambia la fecha (y opcionalmente lugar/responsable). Un control agendado pasa a "reprogramado".
  const reprogramar = async (actor, id, datos, ahora = new Date()) => {
    const { c } = await controlGestionable(actor, id);
    if (["realizado", "cancelado"].includes(c.estado)) throw new CustomError("El control ya está cerrado.", 409);
    if (datos.fechaProgramada < fechaISO(ahora)) throw new CustomError("La nueva fecha no puede ser anterior a hoy.", 400);

    const cambios = {
      fecha_programada: datos.fechaProgramada,
      estado: c.fecha_programada ? "reprogramado" : "programado",
      ...(datos.lugar !== undefined ? { lugar: datos.lugar?.trim() || null } : {}),
      ...(datos.responsable !== undefined ? { responsable: datos.responsable?.trim() || null } : {}),
      actualizado_en: ahora,
    };
    await admin("control_medico").where({ id }).update(cambios);
    const lugar = cambios.lugar !== undefined ? cambios.lugar : c.lugar;
    await avisar(
      c.id_persona,
      c.fecha_programada ? "Cambió la fecha de tu control" : "Tu control ya tiene fecha",
      `${c.tipo_control} · ${legible(datos.fechaProgramada)} · ${lugar || "lugar a confirmar"}.`,
      id,
      ahora
    );
    return { idPersona: c.id_persona };
  };

  const registrarRealizado = async (actor, id, { fechaRealizacion, proximaRevision }, ahora = new Date()) => {
    const { c } = await controlGestionable(actor, id);
    if (c.estado === "cancelado") throw new CustomError("No se puede registrar un control cancelado.", 409);
    if (c.estado === "realizado") throw new CustomError("El control ya figura como realizado.", 409);
    if (fechaRealizacion > fechaISO(ahora)) throw new CustomError("La fecha de realización no puede ser futura.", 400);
    if (proximaRevision && proximaRevision <= fechaRealizacion) {
      throw new CustomError("La próxima revisión tiene que ser posterior a la realización.", 400);
    }
    await admin("control_medico").where({ id }).update({
      estado: "realizado",
      fecha_realizacion: fechaRealizacion,
      proxima_revision: proximaRevision || null,
      actualizado_en: ahora,
    });
    // Un pedido de reprogramación pendiente pierde sentido.
    await admin("solicitud_reprogramacion")
      .where({ id_control: id, estado: "pendiente" })
      .update({ estado: "rechazada", resuelto_por: actor.id_persona, resuelto_en: ahora });
    return { idPersona: c.id_persona };
  };

  const cancelar = async (actor, id, ahora = new Date()) => {
    const { c } = await controlGestionable(actor, id);
    if (["realizado", "cancelado"].includes(c.estado)) throw new CustomError("El control ya está cerrado.", 409);
    await admin("control_medico").where({ id }).update({ estado: "cancelado", actualizado_en: ahora });
    await admin("solicitud_reprogramacion")
      .where({ id_control: id, estado: "pendiente" })
      .update({ estado: "rechazada", resuelto_por: actor.id_persona, resuelto_en: ahora });
    await avisar(c.id_persona, "Se canceló un control", `${c.tipo_control}: el servicio de salud lo canceló.`, id, ahora);
    return { idPersona: c.id_persona };
  };

  // ---------------- Pedidos de reprogramación ----------------

  const listarPedidos = async (actor, ahora = new Date()) => {
    const amb = exigirAmbito(actor);
    const mapa = await empleados();
    const hoy = fechaISO(ahora);
    const filas = await admin("solicitud_reprogramacion as s")
      .join("control_medico as c", "c.id", "s.id_control")
      .where("s.estado", "pendiente")
      .select("s.id", "s.motivo", "s.creado_en", "c.id as id_control", "c.id_persona", "c.tipo_control", "c.fecha_programada", "c.estado", "c.lugar")
      .orderBy("s.creado_en", "asc");
    return filas
      .filter((f) => enAmbito(amb, mapa.get(f.id_persona)))
      .map((f) => {
        const e = mapa.get(f.id_persona);
        return {
          id: f.id,
          motivo: f.motivo,
          creadoEn: aISO(f.creado_en),
          control: { id: f.id_control, tipo: f.tipo_control, fechaProgramada: f.fecha_programada, estado: estadoEfectivo(f, hoy), lugar: f.lugar },
          empleado: { legajo: e?.legajo ?? null, nombre: e?.nombre ?? "Empleado sin datos en el padrón", reparticion: e?.reparticion ?? null },
        };
      });
  };

  const resolverPedido = async (actor, idPedido, { decision, nuevaFecha, nota }, ahora = new Date()) => {
    const pedido = await admin("solicitud_reprogramacion").where({ id: idPedido }).first();
    if (!pedido) throw new CustomError("Pedido no encontrado", 404);
    const { c } = await controlGestionable(actor, pedido.id_control);
    if (pedido.estado !== "pendiente") throw new CustomError("El pedido ya fue resuelto.", 409);

    if (decision === "aceptada") {
      if (!nuevaFecha) throw new CustomError("Indicá la nueva fecha del control.", 400);
      if (nuevaFecha < fechaISO(ahora)) throw new CustomError("La nueva fecha no puede ser anterior a hoy.", 400);
      await admin("control_medico").where({ id: c.id }).update({ fecha_programada: nuevaFecha, estado: "reprogramado", actualizado_en: ahora });
    }
    await admin("solicitud_reprogramacion").where({ id: idPedido }).update({
      estado: decision,
      resuelto_por: actor.id_persona,
      resuelto_en: ahora,
    });
    await avisar(
      c.id_persona,
      decision === "aceptada" ? "Aceptaron tu pedido de cambio de fecha" : "No se pudo cambiar la fecha de tu control",
      decision === "aceptada"
        ? `${c.tipo_control} · nueva fecha: ${legible(nuevaFecha)} · ${c.lugar || "lugar a confirmar"}.`
        : `${c.tipo_control}: se mantiene la fecha original.${nota ? ` ${String(nota).trim().slice(0, 200)}` : " Si lo necesitás, comunicate con el servicio de salud."}`,
      c.id,
      ahora
    );
    return { idPersona: c.id_persona };
  };

  const contarPedidos = async (actor) => {
    if (ambitosAgenda(actor)?.length === 0) return 0;
    return (await listarPedidos(actor)).length;
  };

  return { listar, buscarEmpleados, crear, reprogramar, registrarRealizado, cancelar, listarPedidos, resolverPedido, contarPedidos };
}

module.exports = { crearServicioAgenda, ambitosAgenda, TIPOS_SUGERIDOS };
