const { fechaISO } = require("../../src/utils/fechas");
const { REPARTICIONES } = require("../../src/servicios/identidad/personasFicticias");
const { crearPdfFicticio } = require("./pdfFicticio");
const { completarCuil } = require("../../src/utils/cuil");
const { textoBusqueda } = require("../../src/servicios/padron");

// Datos FICTICIOS para desarrollo y pruebas. Las fechas son relativas a "ahora"
// para que el dashboard siempre muestre controles próximos, vencidos y realizados.
const dias = (ahora, n) => fechaISO(new Date(ahora.getTime() + n * 86400000));

// Registros ficticios: ids desde 900000 y los provisorios del padrón (negativos).
const FICTICIOS = (q) => q.where("id_persona", ">=", 900000).orWhere("id_persona", "<", 0);

// Padrón ficticio de RRHH. Rosa (70020) todavía no ingresó al portal; Ezequiel (70021) no tiene cuenta.
const PADRON = [
  [70001, 900001, "Ficticia", "Lucía", "HACIENDA"],
  [70002, 900002, "Prueba", "Martín", "OBRAS"],
  [70003, 900003, "Demo", "Valeria", "SALUD"],
  [70004, 900004, "Ejemplo", "Diego", "SALUD"],
  [70005, 900005, "Muestra", "Carla", "RRHH"],
  [70006, 900006, "Simulado", "Tomás", "RRHH"],
  [70007, 900007, "Reserva", "Paula", "RRHH"],
  [70020, null, "Pendiente", "Rosa", "HACIENDA"],
  [70021, null, "Nuevo", "Ezequiel", "OBRAS"],
];

async function sembrarPadron(trx, ahora) {
  // Legajos ficticios: 70000 a 99999 (incluye altas de pruebas de importación).
  await trx("padron_empleado").where("legajo", ">=", 70000).andWhere("legajo", "<", 100000).del();
  await trx("empleado_visto").where("id_persona", ">=", 900000).del();
  for (const [legajo, idPersona, apellido, nombre, rep] of PADRON) {
    await trx("padron_empleado").insert({
      legajo,
      cuil: completarCuil(`0020${String(legajo).padStart(6, "0")}`),
      apellido,
      nombre,
      busqueda: textoBusqueda(apellido, nombre),
      reparticion: REPARTICIONES[rep].nombre_reparticion,
      id_reparticion: REPARTICIONES[rep].id_reparticion,
      activo: true,
      id_persona: idPersona,
      vinculado_en: idPersona ? ahora : null,
      creado_en: ahora,
      actualizado_en: ahora,
    });
  }
  // Datos que Capital Humano cargó para Rosa antes de su primer ingreso (id provisorio).
  const rosa = await trx("padron_empleado").where({ legajo: 70020 }).first();
  await trx("datos_laborales").insert({
    id_persona: -rosa.id,
    area: "Tesorería (ficticia)",
    puesto: "Cajera",
    actividad: "Atención al público en caja",
    origen: "capital_humano",
    actualizado_por: 900005,
    actualizado_en: ahora,
  });
  await trx("control_medico").insert({
    id_persona: -rosa.id,
    tipo_control: "Examen periódico anual",
    fecha_programada: dias(ahora, 15),
    estado: "programado",
    lugar: "Consultorio de Salud Laboral (ficticio)",
    responsable: "Servicio de Salud Laboral",
    creado_por: 900004,
    creado_en: ahora,
    actualizado_en: ahora,
  });
}

async function sembrar(dbs, cifrador, { ahora = new Date(), almacenamiento = null } = {}) {
  const { admin, clinica } = dbs;

  // Archivos ficticios: si hay almacenamiento se guardan PDFs reales (cifrados) para poder descargarlos.
  if (almacenamiento) {
    const previos = [
      ...(await admin("documento_salud").where(FICTICIOS).select("ruta_almacenamiento")),
      ...(await clinica("documento_clinico").where(FICTICIOS).select("ruta_almacenamiento")),
    ];
    for (const { ruta_almacenamiento: ruta } of previos) await almacenamiento.eliminar(ruta);
  }
  const archivo = async (lineas, indice) => {
    if (!almacenamiento) return { ruta_almacenamiento: `ficticio/${indice}.pdf`, sha256: String(indice).repeat(64), tamano: 1024 };
    const contenido = crearPdfFicticio(lineas);
    const { ruta, sha256 } = await almacenamiento.guardar(contenido);
    return { ruta_almacenamiento: ruta, sha256, tamano: contenido.length };
  };
  const archivos = {
    constancia: await archivo(["Constancia de asistencia", "Lucia Ficticia - Legajo 70001", "Examen periodico anual"], 0),
    turno: await archivo(["Constancia de turno presentada", "Lucia Ficticia - Legajo 70001"], 1),
    laboratorio: await archivo(["Estudio de laboratorio", "Lucia Ficticia", "Contenido de ejemplo sin datos reales"], 2),
  };

  await admin.transaction(async (trx) => {
    for (const tabla of [
      "solicitud_reprogramacion",
      "recordatorio",
      "documento_salud",
      "control_medico",
      "contacto_emergencia",
      "datos_contacto",
      "preferencia_notificacion",
      "riesgo_ocupacional",
      "asignacion_rol_salud",
      "datos_laborales",
      "correccion_ficha",
    ]) {
      await trx(tabla).where(FICTICIOS).del();
    }

    await sembrarPadron(trx, ahora);

    await trx("asignacion_rol_salud").insert([
      { id_persona: 900003, rol: "PROFESIONAL_SALUD", ambito_id_reparticion: REPARTICIONES.OBRAS.id_reparticion, vigente_desde: new Date(ahora.getTime() - 86400000) },
      { id_persona: 900004, rol: "COORDINADOR_SALUD", ambito_id_reparticion: null, vigente_desde: new Date(ahora.getTime() - 86400000) },
      { id_persona: 900005, rol: "RECURSOS_HUMANOS", ambito_id_reparticion: null, vigente_desde: new Date(ahora.getTime() - 86400000) },
      { id_persona: 900006, rol: "ADMINISTRADOR_TECNICO", ambito_id_reparticion: null, vigente_desde: new Date(ahora.getTime() - 86400000) },
      { id_persona: 900007, rol: "CAPITAL_HUMANO_SALUD", ambito_id_reparticion: null, vigente_desde: new Date(ahora.getTime() - 86400000) },
    ]);

    // Datos laborales cargados por Capital Humano (Carla, 900005).
    const laborales = (id_persona, area, puesto, actividad) => ({
      id_persona, area, puesto, actividad, origen: "capital_humano", actualizado_por: 900005, actualizado_en: ahora,
    });
    await trx("datos_laborales").insert([
      laborales(900001, "Dirección de Presupuesto (ficticia)", "Analista administrativa", "Tareas administrativas de oficina"),
      // Martín ya corrigió su puesto: la corrección queda pendiente en la bandeja de Capital Humano.
      laborales(900002, "Mantenimiento vial (ficticia)", "Capataz de cuadrilla", "Bacheo y señalización en vía pública"),
    ]);
    await trx("correccion_ficha").insert({
      id_persona: 900002,
      seccion: "laboral",
      campo: "puesto",
      valor_anterior: "Operario",
      valor_nuevo: "Capataz de cuadrilla",
      estado: "pendiente",
      persona_nombre: "Martín Prueba",
      persona_legajo: 70002,
      id_reparticion: REPARTICIONES.OBRAS.id_reparticion,
      reparticion: REPARTICIONES.OBRAS.nombre_reparticion,
      creado_en: new Date(ahora.getTime() - 86400000),
      actualizado_en: new Date(ahora.getTime() - 86400000),
    });

    const control = (id_persona, datos) => ({
      id_persona,
      lugar: "Consultorio de Salud Laboral (ficticio)",
      responsable: "Servicio de Salud Laboral",
      creado_por: 900004,
      creado_en: ahora,
      actualizado_en: ahora,
      ...datos,
    });

    // Lucía (900001): perfil casi completo, con próximo control, uno vencido y realizados.
    const insertarControl = (datos) =>
      trx("control_medico")
        .insert(datos)
        .returning("id")
        .then((r) => r.map((x) => (typeof x === "object" ? x.id : x))[0]);

    const idProximo = await insertarControl(
      control(900001, { tipo_control: "Examen periódico anual", fecha_programada: dias(ahora, 6), estado: "programado" })
    );
    await trx("control_medico").insert([
      control(900001, { tipo_control: "Control de agudeza visual", fecha_programada: dias(ahora, -10), estado: "programado" }),
      control(900001, { tipo_control: "Actualización de vacunación", fecha_programada: null, estado: "pendiente" }),
      control(900001, { tipo_control: "Control de laboratorio", fecha_programada: dias(ahora, -200), fecha_realizacion: dias(ahora, -200), estado: "realizado" }),
      control(900001, { tipo_control: "Evaluación ergonómica del puesto", fecha_programada: dias(ahora, 20), estado: "reprogramado" }),
      control(900001, { tipo_control: "Control audiométrico", fecha_programada: dias(ahora, -40), estado: "cancelado" }),
    ]);
    const idAnualAnterior = await insertarControl(
      control(900001, {
        tipo_control: "Examen periódico anual",
        fecha_programada: dias(ahora, -370),
        fecha_realizacion: dias(ahora, -368),
        estado: "realizado",
        proxima_revision: dias(ahora, 6),
      })
    );

    await trx("recordatorio").insert([
      { id_persona: 900001, tipo: "control", titulo: "Tenés un control en 6 días", mensaje: "Recordá asistir al control programado. Revisá fecha y lugar en Mis controles.", id_control: idProximo, programado_para: new Date(ahora.getTime() - 3600000), creado_en: ahora },
      { id_persona: 900001, tipo: "documentacion", titulo: "Documentación pendiente", mensaje: "Tenés una constancia pendiente de validación.", programado_para: new Date(ahora.getTime() - 7200000), creado_en: ahora },
      { id_persona: 900001, tipo: "general", titulo: "Bienvenida a Mi Salud", mensaje: "Completá tu ficha para que el servicio de salud pueda acompañarte mejor.", programado_para: new Date(ahora.getTime() - 5 * 86400000), leido_en: new Date(ahora.getTime() - 4 * 86400000), creado_en: ahora },
      // Programado a futuro: todavía no se muestra.
      { id_persona: 900001, tipo: "general", titulo: "Recordatorio futuro", mensaje: "Todavía no debería verse.", programado_para: new Date(ahora.getTime() + 2 * 86400000), creado_en: ahora },
    ]);

    await trx("contacto_emergencia").insert({
      id_persona: 900001, nombre: "Contacto Ficticio Uno", vinculo: "Hermana", telefono: "0381-000-0001", prioridad: 1, creado_en: ahora, actualizado_en: ahora,
    });
    await trx("preferencia_notificacion").insert({ id_persona: 900001, dias_anticipacion: 3, canal_app: true, actualizado_en: ahora });

    await trx("documento_salud").insert([
      { id_persona: 900001, tipo: "constancia", titulo: "Constancia de asistencia (ficticia)", nombre_original: "constancia.pdf", mime: "application/pdf", ...archivos.constancia, estado_validacion: "validado", subido_por: 900004, validado_por: 900004, validado_en: new Date(ahora.getTime() - 360 * 86400000), id_control: idAnualAnterior, creado_en: new Date(ahora.getTime() - 368 * 86400000) },
      { id_persona: 900001, tipo: "constancia", titulo: "Constancia de turno presentada (ficticia)", nombre_original: "turno.pdf", mime: "application/pdf", ...archivos.turno, estado_validacion: "pendiente", subido_por: 900001, creado_en: new Date(ahora.getTime() - 2 * 86400000) },
    ]);

    // Martín (900002): datos propios para verificar que nadie más los vea.
    await trx("control_medico").insert(
      control(900002, { tipo_control: "Examen de riesgo específico", fecha_programada: dias(ahora, 2), estado: "programado" })
    );
    // Martín pidió cambiar la fecha de su audiometría: queda en la agenda del servicio de salud.
    const idAudiometria = await insertarControl(
      control(900002, { tipo_control: "Audiometría", fecha_programada: dias(ahora, 25), estado: "programado" })
    );
    await trx("solicitud_reprogramacion").insert({
      id_control: idAudiometria,
      id_persona: 900002,
      motivo: "Ese día tengo licencia por vacaciones (ficticio)",
      estado: "pendiente",
      creado_en: new Date(ahora.getTime() - 3600000),
    });
    await trx("riesgo_ocupacional").insert({
      id_persona: 900001, descripcion: "Tareas prolongadas frente a pantallas (ficticio)", identificado_por: 900004, fecha_identificacion: dias(ahora, -90), vigente: true, creado_en: ahora,
    });

    await trx("recordatorio").insert({
      id_persona: 900002, tipo: "turno", titulo: "Turno de Martín", mensaje: "Recordatorio ficticio de otra persona.", programado_para: new Date(ahora.getTime() - 3600000), creado_en: ahora,
    });
  });

  await clinica.transaction(async (trx) => {
    await trx("correccion_clinica").where(FICTICIOS).del();
    await trx("documento_clinico").where(FICTICIOS).del();
    await trx("declaracion_salud").where(FICTICIOS).del();
    await trx("ficha_salud").where(FICTICIOS).del();
    // Ficha de Lucía cargada por Capital Humano (Paula, 900007).
    await trx("ficha_salud").insert({
      id_persona: 900001,
      grupo_sanguineo_cif: cifrador.cifrar("0+"),
      grupo_sanguineo_confirmado: true,
      grupo_sanguineo_confirmado_por: 900007,
      cobertura_cif: cifrador.cifrar("Obra social ficticia"),
      origen: "capital_humano",
      actualizado_por: 900007,
      creado_en: ahora,
      actualizado_en: ahora,
    });
    const declaracion = (id_persona, categoria, texto, origen, registrado_por) => ({
      id_persona,
      categoria,
      descripcion_cif: cifrador.cifrar(texto),
      origen,
      registrado_por,
      vigente: true,
      creado_en: ahora,
      actualizado_en: ahora,
    });
    await trx("declaracion_salud").insert([
      declaracion(900001, "alergia", "Alergia ficticia de ejemplo", "capital_humano", 900007),
      declaracion(900001, "condicion", "Condición ficticia registrada por profesional", "servicio_salud", 900003),
    ]);
    // Martín agregó una medicación: queda pendiente de revisión para Capital Humano (salud).
    const [idMedicacion] = await trx("declaracion_salud")
      .insert(declaracion(900002, "medicacion", "Medicación ficticia de Martín", "empleado", 900002))
      .returning("id")
      .then((r) => r.map((x) => (typeof x === "object" ? x.id : x)));
    await trx("correccion_clinica").insert({
      id_persona: 900002,
      campo: "declaracion",
      id_declaracion: idMedicacion,
      categoria: "medicacion",
      accion: "crear",
      valor_anterior_cif: null,
      valor_nuevo_cif: cifrador.cifrar("Medicación ficticia de Martín"),
      estado: "pendiente",
      persona_nombre: "Martín Prueba",
      persona_legajo: 70002,
      id_reparticion: REPARTICIONES.OBRAS.id_reparticion,
      reparticion: REPARTICIONES.OBRAS.nombre_reparticion,
      creado_en: ahora,
      actualizado_en: ahora,
    });
    await trx("documento_clinico").insert({
      id_persona: 900001,
      tipo: "estudio",
      titulo_cif: cifrador.cifrar("Estudio de laboratorio (ficticio)"),
      nombre_original: "laboratorio.pdf",
      mime: "application/pdf",
      ...archivos.laboratorio,
      estado_validacion: "validado",
      subido_por: 900003,
      validado_por: 900003,
      validado_en: new Date(ahora.getTime() - 199 * 86400000),
      creado_en: new Date(ahora.getTime() - 200 * 86400000),
    });
  });
}

module.exports = { sembrar };
