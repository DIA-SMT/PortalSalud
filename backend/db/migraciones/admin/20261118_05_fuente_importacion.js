// Registra de qué fuente vino cada importación del padrón: csv | cidituc | portal_empleado.
exports.up = async (knex) => {
  await knex.schema.alterTable("importacion_padron", (t) => {
    t.string("fuente", 30).notNullable().defaultTo("csv");
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("importacion_padron", (t) => {
    t.dropColumn("fuente");
  });
};
