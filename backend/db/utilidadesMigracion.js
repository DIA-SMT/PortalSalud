// Convierte una columna enum en texto (la validación pasa a la aplicación).
// En MySQL alcanza con ALTER; en SQLite el enum es un CHECK que knex no quita,
// así que se crea la columna nueva, se copian los datos y se reemplaza.
async function enumATexto(knex, tabla, columna, largo) {
  const cliente = knex.client.config.client;
  if (cliente !== "better-sqlite3" && cliente !== "sqlite3") {
    await knex.schema.alterTable(tabla, (t) => {
      t.string(columna, largo).notNullable().alter();
    });
    return;
  }
  const temporal = `${columna}_texto`;
  await knex.schema.alterTable(tabla, (t) => {
    t.string(temporal, largo);
  });
  await knex(tabla).update({ [temporal]: knex.ref(columna) });
  await knex.raw("ALTER TABLE ?? DROP COLUMN ??", [tabla, columna]);
  await knex.raw("ALTER TABLE ?? RENAME COLUMN ?? TO ??", [tabla, temporal, columna]);
}

module.exports = { enumATexto };
