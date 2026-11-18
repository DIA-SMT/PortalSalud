// Esquema clínico: solo accesible por el titular y por profesionales de salud
// dentro de su ámbito. Los campos con sufijo _cif se guardan cifrados (AES-256-GCM).

exports.up = async (knex) => {
  await knex.schema.createTable("ficha_salud", (t) => {
    t.integer("id_persona").primary();
    t.text("grupo_sanguineo_cif").nullable();
    t.boolean("grupo_sanguineo_confirmado").notNullable().defaultTo(false);
    t.integer("grupo_sanguineo_confirmado_por").nullable();
    t.text("cobertura_cif").nullable();
    t.timestamp("creado_en").notNullable();
    t.timestamp("actualizado_en").notNullable();
  });

  await knex.schema.createTable("declaracion_salud", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.enu("categoria", ["alergia", "antecedente", "condicion", "medicacion"]).notNullable();
    t.text("descripcion_cif").notNullable();
    t.enu("origen", ["autodeclarado", "verificado", "profesional"]).notNullable();
    t.integer("registrado_por").notNullable();
    t.integer("verificado_por").nullable();
    t.timestamp("verificado_en").nullable();
    t.boolean("vigente").notNullable().defaultTo(true);
    t.timestamp("creado_en").notNullable();
    t.timestamp("actualizado_en").notNullable();
  });

  await knex.schema.createTable("registro_aptitud", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.integer("id_control").nullable(); // referencia lógica a control_medico (otro esquema)
    t.enu("resultado", ["apto", "apto_con_restricciones", "no_apto", "pendiente"]).notNullable();
    t.text("detalle_cif").nullable();
    t.integer("profesional").notNullable();
    t.date("fecha").notNullable();
    t.timestamp("creado_en").notNullable();
  });

  await knex.schema.createTable("documento_clinico", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("tipo", 40).notNullable(); // estudio, informe…
    t.text("titulo_cif").notNullable();
    t.string("nombre_original", 200).notNullable();
    t.string("mime", 80).notNullable();
    t.integer("tamano").notNullable();
    t.string("ruta_almacenamiento", 255).notNullable();
    t.string("sha256", 64).notNullable();
    t.enu("estado_validacion", ["pendiente", "validado", "rechazado"]).notNullable().defaultTo("pendiente");
    t.integer("subido_por").notNullable();
    t.integer("validado_por").nullable();
    t.timestamp("validado_en").nullable();
    t.timestamp("creado_en").notNullable();
  });
};

exports.down = async (knex) => {
  for (const tabla of ["documento_clinico", "registro_aptitud", "declaracion_salud", "ficha_salud"]) {
    await knex.schema.dropTableIfExists(tabla);
  }
};
