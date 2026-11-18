const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { cargarConfig } = require("./src/config/entorno");
const { crearConexiones, migrar, cerrar } = require("./src/config/db");
const { crearIdentidad } = require("./src/servicios/identidad");
const { crearApp } = require("./src/app");

async function iniciar() {
  const config = cargarConfig();
  const dbs = crearConexiones(config.db);

  // En desarrollo se migra al arrancar; en el piloto/producción se migra a mano (npm run db:migrar).
  if (!config.esProduccion) await migrar(dbs);

  const identidad = crearIdentidad(config.identidad);
  const { app, sesiones, recordatorios } = crearApp({ config, dbs, identidad });

  const servidor = app.listen(config.puerto, () => {
    console.log(`Portal de Salud API en puerto ${config.puerto} (identidad: ${identidad.modo}, BD: ${config.db.cliente})`);
  });

  const purga = setInterval(() => sesiones.purgarVencidas().catch(() => {}), 15 * 60 * 1000);

  // Recordatorios automáticos: al arrancar y cada hora (es idempotente).
  const generar = () =>
    recordatorios
      .generarAutomaticos()
      .then((n) => n && console.log(`[recordatorios] ${n} nuevos`))
      .catch((e) => console.error("[recordatorios] error al generar:", e.message));
  generar();
  const generador = setInterval(generar, 60 * 60 * 1000);

  const apagar = () => {
    clearInterval(purga);
    clearInterval(generador);
    servidor.close(() => cerrar(dbs).finally(() => process.exit(0)));
  };
  process.on("SIGINT", apagar);
  process.on("SIGTERM", apagar);
}

iniciar().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
