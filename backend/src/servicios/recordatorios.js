const CustomError = require("../utils/CustomError");
const { fechaISO, aISO } = require("../utils/fechas");

const DIAS_ANTICIPACION = [1, 2, 3, 5, 7];
const DIAS_POR_DEFECTO = 3;
const MS_DIA = 86400000;

const FORMATO_FECHA = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const legible = (fechaIso) => FORMATO_FECHA.format(new Date(`${fechaIso}T00:00:00Z`));
const diasEntre = (desdeIso, hastaIso) =>
  Math.round((Date.parse(`${hastaIso}T00:00:00Z`) - Date.parse(`${desdeIso}T00:00:00Z`)) / MS_DIA);

const tituloControl = (faltan) => {
  if (faltan <= 0) return "Hoy tenés un control";
  if (faltan === 1) return "Mañana tenés un control";
  return `Tenés un control en ${faltan} días`;
};

const mapear = (r) => ({
  id: r.id,
  tipo: r.tipo,
  titulo: r.titulo,
  mensaje: r.mensaje,
  idControl: r.id_control,
  programadoPara: aISO(r.programado_para),
  leidoEn: aISO(r.leido_en),
});

function crearServicioRecordatorios({ admin }, { canalesExternos }) {
  // Genera recordatorios para controles agendados según la anticipación que eligió
  // cada empleado. Es idempotente: la clave evita duplicados aunque corra muchas veces.
  const generarAutomaticos = async (ahora = new Date()) => {
    const hoy = fechaISO(ahora);
    const limite = fechaISO(new Date(ahora.getTime() + Math.max(...DIAS_ANTICIPACION) * MS_DIA));
    const controles = await admin("control_medico")
      .whereIn("estado", ["programado", "reprogramado"])
      .whereNotNull("fecha_programada")
      .whereBetween("fecha_programada", [hoy, limite]);
    if (!controles.length) return 0;

    const personas = [...new Set(controles.map((c) => c.id_persona))];
    const preferencias = new Map(
      (await admin("preferencia_notificacion").whereIn("id_persona", personas)).map((p) => [p.id_persona, p])
    );

    const candidatos = controles
      .map((c) => {
        const faltan = diasEntre(hoy, c.fecha_programada);
        const anticipacion = preferencias.get(c.id_persona)?.dias_anticipacion ?? DIAS_POR_DEFECTO;
        if (faltan > anticipacion) return null;
        return {
          id_persona: c.id_persona,
          tipo: "control",
          titulo: tituloControl(faltan),
          mensaje: `${c.tipo_control} · ${legible(c.fecha_programada)} · ${c.lugar || "lugar a confirmar"}.`,
          id_control: c.id,
          programado_para: ahora,
          creado_en: ahora,
          clave_generacion: `control:${c.id}:${c.fecha_programada}`,
        };
      })
      .filter(Boolean);
    if (!candidatos.length) return 0;

    const existentes = new Set(
      (await admin("recordatorio").whereIn("clave_generacion", candidatos.map((c) => c.clave_generacion)).select("clave_generacion")).map(
        (r) => r.clave_generacion
      )
    );
    const nuevos = candidatos.filter((c) => !existentes.has(c.clave_generacion));
    if (nuevos.length) await admin("recordatorio").insert(nuevos).onConflict("clave_generacion").ignore();
    return nuevos.length;
  };

  // Solo se muestran los que ya llegaron a su fecha; primero los no leídos.
  const listar = async (idPersona, ahora = new Date()) => {
    const filas = await admin("recordatorio")
      .where({ id_persona: idPersona })
      .where("programado_para", "<=", ahora)
      .orderByRaw("CASE WHEN leido_en IS NULL THEN 0 ELSE 1 END")
      .orderBy("programado_para", "desc")
      .limit(50);
    const recordatorios = filas.map(mapear);
    return { recordatorios, noLeidos: recordatorios.filter((r) => !r.leidoEn).length };
  };

  const contarNoLeidos = async (idPersona, ahora = new Date()) => {
    const fila = await admin("recordatorio")
      .where({ id_persona: idPersona })
      .whereNull("leido_en")
      .where("programado_para", "<=", ahora)
      .count({ cantidad: "*" })
      .first();
    return Number(fila?.cantidad || 0);
  };

  // Confirmación de lectura. Idempotente: marcar dos veces no cambia la fecha original.
  const marcarLeido = async (idPersona, id, ahora = new Date()) => {
    const fila = await admin("recordatorio").where({ id, id_persona: idPersona }).first();
    if (!fila) throw new CustomError("Recordatorio no encontrado", 404);
    if (!fila.leido_en) await admin("recordatorio").where({ id }).update({ leido_en: ahora });
    return mapear(await admin("recordatorio").where({ id }).first());
  };

  const marcarTodosLeidos = async (idPersona, ahora = new Date()) =>
    admin("recordatorio")
      .where({ id_persona: idPersona })
      .whereNull("leido_en")
      .where("programado_para", "<=", ahora)
      .update({ leido_en: ahora });

  // ---------------- Preferencias ----------------

  const obtenerPreferencias = async (idPersona) => {
    const p = await admin("preferencia_notificacion").where({ id_persona: idPersona }).first();
    return {
      configurado: Boolean(p),
      diasAnticipacion: p?.dias_anticipacion ?? DIAS_POR_DEFECTO,
      opcionesDias: DIAS_ANTICIPACION,
      canalApp: true, // las notificaciones dentro del portal siempre están activas
      canalEmail: Boolean(p?.canal_email),
      canalWhatsapp: Boolean(p?.canal_whatsapp),
      canalesDisponibles: { ...canalesExternos },
    };
  };

  const guardarPreferencias = async (idPersona, datos, ahora = new Date()) => {
    const actual = await admin("preferencia_notificacion").where({ id_persona: idPersona }).first();
    const fila = {
      dias_anticipacion: datos.diasAnticipacion,
      canal_app: true,
      canal_email: Boolean(actual?.canal_email),
      consentimiento_email_en: actual?.consentimiento_email_en ?? null,
      canal_whatsapp: Boolean(actual?.canal_whatsapp),
      consentimiento_whatsapp_en: actual?.consentimiento_whatsapp_en ?? null,
      actualizado_en: ahora,
    };

    // Canales externos: solo si el servicio existe y con consentimiento expreso.
    for (const [canal, campo, consentimiento] of [
      ["email", "canal_email", "consentimiento_email_en"],
      ["whatsapp", "canal_whatsapp", "consentimiento_whatsapp_en"],
    ]) {
      const pedido = datos[canal === "email" ? "canalEmail" : "canalWhatsapp"];
      if (pedido === undefined || Boolean(pedido) === fila[campo]) continue;
      if (pedido) {
        if (!canalesExternos[canal]) {
          throw new CustomError("Ese canal todavía no está disponible.", 409);
        }
        if (datos.consentimiento !== true) {
          throw new CustomError("Para activar avisos fuera del portal necesitamos tu consentimiento.", 400);
        }
        fila[campo] = true;
        fila[consentimiento] = ahora;
      } else {
        fila[campo] = false;
        fila[consentimiento] = null;
      }
    }

    if (actual) await admin("preferencia_notificacion").where({ id_persona: idPersona }).update(fila);
    else await admin("preferencia_notificacion").insert({ id_persona: idPersona, ...fila });
    return obtenerPreferencias(idPersona);
  };

  return {
    generarAutomaticos,
    listar,
    contarNoLeidos,
    marcarLeido,
    marcarTodosLeidos,
    obtenerPreferencias,
    guardarPreferencias,
  };
}

// Texto para canales externos (email, WhatsApp) cuando existan. Por regla, nunca
// lleva el tipo de control, diagnósticos ni datos clínicos: solo invita a entrar al portal.
const textoParaCanalExterno = () =>
  "Tenés una novedad en Mi Salud (Portal del Empleado). Ingresá desde Ciudad Digital para verla.";

module.exports = { crearServicioRecordatorios, textoParaCanalExterno, DIAS_ANTICIPACION };
