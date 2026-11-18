// Origen de los datos de salud y correcciones del empleado con revisión posterior.
const { enumATexto } = require("../../utilidadesMigracion");

exports.up = async (knex) => {
  // Origen: capital_humano | servicio_salud | empleado (antes: verificado | profesional | autodeclarado).
  await enumATexto(knex, "declaracion_salud", "origen", 20);
  await knex("declaracion_salud").where({ origen: "autodeclarado" }).update({ origen: "empleado" });
  await knex("declaracion_salud").where({ origen: "profesional" }).update({ origen: "servicio_salud" });
  await knex("declaracion_salud").where({ origen: "verificado" }).update({ origen: "capital_humano" });

  await knex.schema.alterTable("ficha_salud", (t) => {
    t.string("origen", 20).notNullable().defaultTo("empleado");
    t.integer("actualizado_por").nullable();
  });

  // Bandeja de correcciones de datos de salud. Los valores van cifrados.
  await knex.schema.createTable("correccion_clinica", (t) => {
    t.increments("id");
    t.integer("id_persona").notNullable().index();
    t.string("campo", 40).notNullable(); // grupo_sanguineo | cobertura | declaracion
    t.integer("id_declaracion").nullable();
    t.string("categoria", 20).nullable(); // para declaraciones
    t.string("accion", 20).notNullable(); // crear | modificar | baja
    t.text("valor_anterior_cif").nullable();
    t.text("valor_nuevo_cif").nullable();
    t.string("estado", 20).notNullable().defaultTo("pendiente").index();
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
  await knex.schema.dropTableIfExists("correccion_clinica");
  await knex.schema.alterTable("ficha_salud", (t) => {
    t.dropColumn("origen");
    t.dropColumn("actualizado_por");
  });
};
