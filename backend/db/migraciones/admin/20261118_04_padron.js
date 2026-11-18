// Padrón de empleados importado desde RRHH y vínculo con las cuentas de CiDiTuc.
//
// Las fichas se guardan por id_persona (CiDiTuc). Para quien todavía no ingresó al
// portal se usa un id provisorio negativo (-id del padrón); al primer ingreso se
// reemplaza por el id real en todas las tablas.

exports.up = async (knex) => {
  await knex.schema.createTable("importacion_padron", (t) => {
    t.increments("id");
    t.string("archivo_nombre", 200).notNullable();
    t.integer("filas_total").notNullable();
    t.integer("altas").notNullable();
    t.integer("actualizaciones").notNullable();
    t.integer("sin_cambios").notNullable();
    t.integer("bajas").notNullable();
    t.integer("errores").notNullable();
    t.boolean("padron_completo").notNullable().defaultTo(false);
    t.integer("importado_por").notNullable();
    t.timestamp("creado_en").notNullable();
  });

  await knex.schema.createTable("padron_empleado", (t) => {
    t.increments("id");
    t.integer("legajo").notNullable().unique();
    t.string("cuil", 11).notNullable().index();
    t.string("apellido", 120).notNullable();
    t.string("nombre", 120).notNullable();
    t.string("busqueda", 260).notNullable().index(); // "apellido nombre" en minúsculas y sin tildes
    t.string("reparticion", 160).nullable();
    t.integer("id_reparticion").nullable().index(); // id de CiDiTuc, para el ámbito de los roles
    t.boolean("activo").notNullable().defaultTo(true);
    t.integer("id_persona").nullable().unique(); // null hasta el primer ingreso
    t.timestamp("vinculado_en").nullable();
    t.integer("id_importacion").nullable().references("id").inTable("importacion_padron");
    t.timestamp("creado_en").notNullable();
    t.timestamp("actualizado_en").notNullable();
  });

  // Empleados que ya ingresaron al portal: permite vincular el padrón al importarlo.
  await knex.schema.createTable("empleado_visto", (t) => {
    t.integer("id_persona").primary();
    t.integer("legajo").nullable().index();
    t.string("persona_nombre", 160).notNullable();
    t.integer("id_reparticion").nullable();
    t.string("reparticion", 160).nullable();
    t.timestamp("ultimo_ingreso").notNullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("empleado_visto");
  await knex.schema.dropTableIfExists("padron_empleado");
  await knex.schema.dropTableIfExists("importacion_padron");
};
