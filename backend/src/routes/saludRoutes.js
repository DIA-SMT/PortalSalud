const { Router } = require("express");
const { body, param } = require("express-validator");
const { requiereSesion, autorizar, contextoPropio } = require("../middlewares/sesion");
const { validarCampos } = require("../middlewares/errores");
const { obtenerResumen } = require("../servicios/resumen");
const { crearServicioControles } = require("../servicios/controles");
const { DIAS_ANTICIPACION } = require("../servicios/recordatorios");
const { crearFichaRoutes } = require("./fichaRoutes");
const { crearDocumentosRoutes } = require("./documentosRoutes");
const { crearServicioDocumentos } = require("../servicios/documentos");

const idValido = [param("id").isInt({ min: 1 }).withMessage("Identificador inválido").toInt(), validarCampos];

// Envuelve un handler async para mandar los errores al manejador central.
const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// Rutas del empleado sobre sus propios datos. El titular sale siempre de la sesión.
function crearSaludRoutes(deps) {
  const { dbs, config, recordatorios, cifrador, almacenamiento } = deps;
  const controles = crearServicioControles(dbs, config);
  const documentos = crearServicioDocumentos(dbs, cifrador, almacenamiento);
  const router = Router();

  router.use(requiereSesion(deps));
  const leerPropios = autorizar(deps, "leer", "datos_propios", contextoPropio);
  const editarPropios = autorizar(deps, "editar", "datos_propios", contextoPropio);

  // ---------- Dashboard ----------
  router.get("/mi-resumen", leerPropios, manejar(async (req, res) => {
    res.json(await obtenerResumen(dbs, req.actor.id_persona));
  }));

  // ---------- Ficha ----------
  router.use("/ficha", crearFichaRoutes(deps));

  // ---------- Documentos e historial ----------
  router.use(crearDocumentosRoutes(deps, { documentos, controles }));

  // ---------- Controles (agenda administrativa) ----------
  router.get("/controles", leerPropios, manejar(async (req, res) => {
    res.json({ controles: await controles.listar(req.actor.id_persona) });
  }));

  router.get("/controles/:id", leerPropios, idValido, manejar(async (req, res) => {
    res.json(await controles.obtener(req.actor.id_persona, req.params.id));
  }));

  router.post(
    "/controles/:id/reprogramacion",
    editarPropios,
    idValido,
    body("motivo").isString().trim().isLength({ min: 5, max: 300 }).withMessage("Contanos el motivo en 5 a 300 caracteres"),
    validarCampos,
    manejar(async (req, res) => {
      res.status(201).json(await controles.solicitarReprogramacion(req.actor.id_persona, req.params.id, req.body.motivo));
    })
  );

  // ---------- Recordatorios ----------
  router.get("/recordatorios", leerPropios, manejar(async (req, res) => {
    res.json(await recordatorios.listar(req.actor.id_persona));
  }));

  router.get("/recordatorios/no-leidos", leerPropios, manejar(async (req, res) => {
    res.json({ cantidad: await recordatorios.contarNoLeidos(req.actor.id_persona) });
  }));

  router.post("/recordatorios/leidos", editarPropios, manejar(async (req, res) => {
    await recordatorios.marcarTodosLeidos(req.actor.id_persona);
    res.json({ cantidad: 0 });
  }));

  router.post("/recordatorios/:id/leido", editarPropios, idValido, manejar(async (req, res) => {
    res.json(await recordatorios.marcarLeido(req.actor.id_persona, req.params.id));
  }));

  // ---------- Preferencias de notificación ----------
  router.get("/preferencias", leerPropios, manejar(async (req, res) => {
    res.json(await recordatorios.obtenerPreferencias(req.actor.id_persona));
  }));

  router.put(
    "/preferencias",
    editarPropios,
    body("diasAnticipacion").isIn(DIAS_ANTICIPACION).withMessage("Elegí una anticipación válida").toInt(),
    body("canalEmail").optional().isBoolean().toBoolean(),
    body("canalWhatsapp").optional().isBoolean().toBoolean(),
    body("consentimiento").optional().isBoolean().toBoolean(),
    validarCampos,
    manejar(async (req, res) => {
      res.json(await recordatorios.guardarPreferencias(req.actor.id_persona, req.body));
    })
  );

  return router;
}

module.exports = { crearSaludRoutes };
