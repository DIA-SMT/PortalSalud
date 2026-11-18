// Carga de la ficha por Capital Humano y correcciones del empleado con revisión posterior.
const { enumATexto } = require("../../utilidadesMigracion");

exports.up = async (knex) => {
  // Los roles pasan a texto validado en la aplicación (se suma CAPITAL_HUMANO_SALUD).
  await enumATexto(knex, "asignacion_rol_salud", "rol", 40);

  // Quién cargó por última vez los medios de contacto: capital_humano | empleado.
  await knex.schema.alterTable("datos_contacto", (t) => {
    t.string("origen", 20).notNullable().defaultTo("empleado");
    t.integer("actualizado_por").nullable();
  });

  // Datos laborales que carga Capital Humano (legajo y repartición vienen de CiDiTuc).
  await knex.schema.createTable("datos_laborales", (t) => {
    t.integer("id_persona").primary();
    t.string("area", 160).nullable();
    t.string("puesto", 160).nullable();
    t.string("actividad", 240).nullable();
    t.string("origen", 20).notNullable().defaultTo("capital_humano");
    t.integer("actualizado_por").nullable();
    t.timestamp("actualizado_en").notNullable();
  });

  // Bandeja de correcciones de datos administrativos (contacto y laborales).
  // Guarda el valor anterior para poder revertir y una copia mínima de la persona
  // para que el área responsable sepa de quién es sin consultar otra base.
  await knex.schema.createTable("correccion_ficha", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("seccion", 20).notNullable(); // contacto | laboral
    t.string("campo", 40).notNullable();
    t.string("valor_anterior", 240).nullable();
    t.string("valor_nuevo", 240).nullable();
    t.string("estado", 20).notNullable().defaultTo("pendiente").index(); // pendiente | revisada | revertida
    t.string("persona_nombre", 160).notNullable();
    t.integer("persona_legajo").nullable();
    t.integer("id_reparticion").nullable().index();
    t.string("reparticion", 160).nullable();
    t.timestamp("creado_en").notNullable();
    t.timestamp("actualizado_en").notNullable();
    t.integer("revisado_por").nullable();
    t.timestamp("revisado_en").nullable();
    t.string("nota", 300).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("correccion_ficha");
  await knex.schema.dropTableIfExists("datos_laborales");
  await knex.schema.alterTable("datos_contacto", (t) => {
    t.dropColumn("origen");
    t.dropColumn("actualizado_por");
  });
};
