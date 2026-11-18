const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { cargarConfig } = require("../src/config/entorno");
const { crearConexiones, migrar, cerrar } = require("../src/config/db");

(async () => {
  const dbs = crearConexiones(cargarConfig().db);
  try {
    await migrar(dbs);
    console.log("Migraciones aplicadas (admin y clínica).");
  } finally {
    await cerrar(dbs);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
