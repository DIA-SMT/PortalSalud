const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { cargarConfig } = require("../src/config/entorno");
const { crearConexiones, migrar, cerrar } = require("../src/config/db");
const { crearCifrador } = require("../src/servicios/cifrado");
const { crearAlmacenamiento } = require("../src/servicios/almacenamiento");
const { sembrar } = require("../db/seeds/datosFicticios");

(async () => {
  const config = cargarConfig();
  if (config.esProduccion) throw new Error("El seed de datos ficticios no se ejecuta en producción.");
  const dbs = crearConexiones(config.db);
  try {
    await migrar(dbs);
    const cifrador = crearCifrador(config.claveCifrado);
    await sembrar(dbs, cifrador, { almacenamiento: crearAlmacenamiento(config.documentosDir, cifrador) });
    console.log("Datos ficticios cargados.");
  } finally {
    await cerrar(dbs);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
