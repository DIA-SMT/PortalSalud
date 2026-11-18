const fs = require("fs");
const path = require("path");
const knex = require("knex");

const DIR_MIGRACIONES = path.join(__dirname, "..", "..", "db", "migraciones");

// Dos conexiones separadas a propósito: los datos administrativos y los
// clínicos viven en esquemas distintos, con usuarios de BD distintos en MySQL.
// Las rutas que no necesitan datos clínicos nunca reciben la conexión clínica.
function crearConexion(cliente, conexion, nombre) {
  if (cliente === "better-sqlite3" && conexion.filename !== ":memory:") {
    fs.mkdirSync(path.dirname(conexion.filename), { recursive: true });
  }
  return knex({
    client: cliente,
    connection: conexion,
    useNullAsDefault: cliente === "better-sqlite3",
    pool: cliente === "better-sqlite3" ? { min: 1, max: 1 } : { min: 0, max: 10 },
    migrations: {
      directory: path.join(DIR_MIGRACIONES, nombre),
      tableName: "knex_migraciones",
    },
  });
}

function crearConexiones(configDb) {
  return {
    admin: crearConexion(configDb.cliente, configDb.admin, "admin"),
    clinica: crearConexion(configDb.cliente, configDb.clinica, "clinica"),
  };
}

async function migrar(dbs) {
  await dbs.admin.migrate.latest();
  await dbs.clinica.migrate.latest();
}

async function cerrar(dbs) {
  await Promise.all([dbs.admin.destroy(), dbs.clinica.destroy()]);
}

module.exports = { crearConexiones, migrar, cerrar };
