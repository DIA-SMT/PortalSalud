// Recordatorios automáticos y solicitudes de reprogramación.

exports.up = async (knex) => {
  // Clave que identifica a un recordatorio generado automáticamente (p. ej.
  // "control:15:2026-11-24"), para no duplicarlo aunque el generador corra muchas veces.
  await knex.schema.alterTable("recordatorio", (t) => {
    t.string("clave_generacion", 80).nullable().unique();
  });

  await knex.schema.createTable("solicitud_reprogramacion", (t) => {
    t.increments("id");
    t.integer("id_control").notNullable().references("id").inTable("control_medico").onDelete("CASCADE");
    t.integer("id_persona").notNullable().index();
    t.string("motivo", 300).notNullable(); // administrativo: se pide no incluir datos médicos
    t.enu("estado", ["pendiente", "aceptada", "rechazada"]).notNullable().defaultTo("pendiente");
    t.integer("resuelto_por").nullable();
    t.timestamp("resuelto_en").nullable();
    t.timestamp("creado_en").notNullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("solicitud_reprogramacion");
  await knex.schema.alterTable("recordatorio", (t) => {
    t.dropUnique(["clave_generacion"]);
    t.dropColumn("clave_generacion");
  });
};
