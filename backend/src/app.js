const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { verificarOrigen, sinCache, registroAccesos } = require("./middlewares/seguridad");
const { noEncontrado, manejadorErrores } = require("./middlewares/errores");
const { crearServicioSesiones } = require("./servicios/sesiones");
const { crearCifrador } = require("./servicios/cifrado");
const { crearServicioRecordatorios } = require("./servicios/recordatorios");
const { crearAlmacenamiento } = require("./servicios/almacenamiento");
const { crearServicioPadron } = require("./servicios/padron");
const { crearFuentesEmpleados } = require("./servicios/fuentesEmpleados");
const { crearSesionRoutes } = require("./routes/sesionRoutes");
const { crearSaludRoutes } = require("./routes/saludRoutes");
const { crearGestionRoutes } = require("./routes/gestionRoutes");

// Arma la app con sus dependencias inyectadas (facilita las pruebas).
function crearApp({ config, dbs, identidad, registrarAccesos = true, fetchImpl }) {
  const sesiones = crearServicioSesiones(dbs.admin, config.sesion);
  const cifrador = crearCifrador(config.claveCifrado);
  const recordatorios = crearServicioRecordatorios(dbs, config);
  const almacenamiento = crearAlmacenamiento(config.documentosDir, cifrador);
  const padron = crearServicioPadron(dbs);
  const fuentes = crearFuentesEmpleados(config.fuentesEmpleados, fetchImpl);
  const deps = { config, dbs, identidad, sesiones, cifrador, recordatorios, almacenamiento, padron, fuentes };

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  if (registrarAccesos) app.use(registroAccesos);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(sinCache);
  api.use(verificarOrigen(config.origenPermitido));
  api.get("/salud-servicio", (_req, res) => res.json({ ok: true }));
  api.use("/sesion", crearSesionRoutes(deps));
  api.use("/salud", crearSaludRoutes(deps));
  api.use("/gestion", crearGestionRoutes(deps));
  api.use(noEncontrado);

  app.use("/api", api);
  app.use(manejadorErrores);

  return { app, sesiones, recordatorios };
}

module.exports = { crearApp };
