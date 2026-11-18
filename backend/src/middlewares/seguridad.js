const CustomError = require("../utils/CustomError");

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

// Protección CSRF para peticiones que modifican datos. Además de la cookie
// SameSite=Strict, exige un encabezado propio (un navegador no puede enviarlo
// desde otro origen sin un preflight CORS que esta API no habilita) y, si el
// navegador manda Origin, que coincida con el frontend permitido.
const verificarOrigen = (origenPermitido) => (req, _res, next) => {
  if (METODOS_SEGUROS.has(req.method)) return next();
  const origen = req.get("origin");
  if (req.get("x-portal-salud") !== "1" || (origen && origen !== origenPermitido)) {
    return next(new CustomError("Solicitud rechazada", 403));
  }
  next();
};

// Las respuestas de la API contienen datos personales: nunca se cachean.
const sinCache = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  next();
};

// Log de acceso mínimo: sin query string, cuerpo, cookies ni encabezados.
const registroAccesos = (req, res, next) => {
  const inicio = process.hrtime.bigint();
  const ruta = req.originalUrl.split("?")[0];
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`${req.method} ${ruta} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};

module.exports = { verificarOrigen, sinCache, registroAccesos };
