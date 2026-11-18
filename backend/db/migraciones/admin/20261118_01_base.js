// Esquema administrativo: datos operativos sin contenido clínico.
// `id_persona` es una referencia lógica a persona de CiDiTuc (otra base, sin FK).

const ESTADOS_CONTROL = ["programado", "pendiente", "realizado", "reprogramado", "vencido", "cancelado"];
const ROLES = ["PROFESIONAL_SALUD", "COORDINADOR_SALUD", "RECURSOS_HUMANOS", "ADMINISTRADOR_TECNICO"];

exports.up = async (knex) => {
  await knex.schema.createTable("sesion", (t) => {
    t.string("id_hash", 64).primary(); // sha256 del identificador; el valor real solo está en la cookie
    t.integer("id_persona").notNullable().index();
    t.text("datos").notNullable(); // instantánea de identidad del SSO, vive lo que vive la sesión
    t.timestamp("creada_en").notNullable();
    t.timestamp("ultima_actividad").notNullable();
    t.timestamp("expira_en").notNullable().index();
  });

  await knex.schema.createTable("asignacion_rol_salud", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.enu("rol", ROLES).notNullable();
    t.integer("ambito_id_reparticion").nullable(); // null = todas las reparticiones
    t.timestamp("vigente_desde").notNullable();
    t.timestamp("vigente_hasta").nullable();
    t.integer("otorgado_por").nullable();
    t.timestamp("revocado_en").nullable();
    t.integer("revocado_por").nullable();
  });

  await knex.schema.createTable("datos_contacto", (t) => {
    t.integer("id_persona").primary();
    t.string("telefono_alternativo", 30).nullable();
    t.string("email_alternativo", 120).nullable();
    t.timestamp("actualizado_en").notNullable();
  });

  await knex.schema.createTable("contacto_emergencia", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("nombre", 120).notNullable();
    t.string("vinculo", 60).notNullable();
    t.string("telefono", 30).notNullable();
    t.string("telefono_alternativo", 30).nullable();
    t.integer("prioridad").notNullable().defaultTo(1);
    t.timestamp("creado_en").notNullable();
    t.timestamp("actualizado_en").notNullable();
  });

  await knex.schema.createTable("control_medico", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("tipo_control", 80).notNullable(); // administrativo: "Examen periódico", "Control de laboratorio"…
    t.date("fecha_programada").nullable();
    t.date("fecha_realizacion").nullable();
    t.enu("estado", ESTADOS_CONTROL).notNullable().defaultTo("pendiente");
    t.string("lugar", 160).nullable();
    t.string("responsable", 160).nullable();
    t.date("proxima_revision").nullable();
    t.integer("creado_por").nullable();
    t.timestamp("creado_en").notNullable();
    t.timestamp("actualizado_en").notNullable();
  });

  await knex.schema.createTable("riesgo_ocupacional", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("descripcion", 240).notNullable();
    t.integer("identificado_por").notNullable();
    t.date("fecha_identificacion").notNullable();
    t.boolean("vigente").notNullable().defaultTo(true);
    t.timestamp("creado_en").notNullable();
  });

  await knex.schema.createTable("recordatorio", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.enu("tipo", ["control", "turno", "documentacion", "general"]).notNullable();
    t.string("titulo", 120).notNullable();
    t.string("mensaje", 400).notNullable(); // nunca contenido clínico
    t.integer("id_control").nullable().references("id").inTable("control_medico").onDelete("SET NULL");
    t.timestamp("programado_para").notNullable();
    t.timestamp("leido_en").nullable();
    t.timestamp("creado_en").notNullable();
  });

  await knex.schema.createTable("preferencia_notificacion", (t) => {
    t.integer("id_persona").primary();
    t.integer("dias_anticipacion").notNullable().defaultTo(3);
    t.boolean("canal_app").notNullable().defaultTo(true);
    t.boolean("canal_email").notNullable().defaultTo(false);
    t.timestamp("consentimiento_email_en").nullable();
    t.boolean("canal_whatsapp").notNullable().defaultTo(false);
    t.timestamp("consentimiento_whatsapp_en").nullable();
    t.timestamp("actualizado_en").notNullable();
  });

  // Constancias y documentos administrativos (los clínicos van en el esquema clínico).
  await knex.schema.createTable("documento_salud", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("tipo", 40).notNullable(); // constancia, certificado, turno…
    t.string("titulo", 160).notNullable();
    t.string("nombre_original", 200).notNullable();
    t.string("mime", 80).notNullable();
    t.integer("tamano").notNullable();
    t.string("ruta_almacenamiento", 255).notNullable();
    t.string("sha256", 64).notNullable();
    t.enu("estado_validacion", ["pendiente", "validado", "rechazado"]).notNullable().defaultTo("pendiente");
    t.integer("subido_por").notNullable();
    t.integer("validado_por").nullable();
    t.timestamp("validado_en").nullable();
    t.integer("id_control").nullable().references("id").inTable("control_medico").onDelete("SET NULL");
    t.timestamp("creado_en").notNullable();
  });

  // Auditoría append-only: el código solo inserta y lee. En MySQL, el usuario
  // de la app debe tener únicamente INSERT y SELECT sobre esta tabla.
  await knex.schema.createTable("auditoria_salud", (t) => {
    t.increments("id");
    t.timestamp("fecha").notNullable().index();
    t.integer("id_persona_actor").nullable().index();
    t.string("roles_actor", 160).nullable();
    t.string("accion", 60).notNullable();
    t.string("recurso", 60).notNullable();
    t.integer("id_persona_titular").nullable().index();
    t.enu("resultado", ["permitido", "denegado", "error"]).notNullable();
    t.string("detalle", 400).nullable(); // nunca contenido clínico
    t.string("ip", 64).nullable();
  });
};

exports.down = async (knex) => {
  for (const tabla of [
    "auditoria_salud",
    "documento_salud",
    "preferencia_notificacion",
    "recordatorio",
    "riesgo_ocupacional",
    "control_medico",
    "contacto_emergencia",
    "datos_contacto",
    "asignacion_rol_salud",
    "sesion",
  ]) {
    await knex.schema.dropTableIfExists(tabla);
  }
};
