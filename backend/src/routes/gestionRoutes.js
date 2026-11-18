const { Router } = require("express");
const { body, query } = require("express-validator");
const { validarCampos } = require("../middlewares/errores");
const { requiereSesion } = require("../middlewares/sesion");
const { registrarAuditoria } = require("../servicios/auditoria");
const { crearServicioCorrecciones } = require("../servicios/correcciones");
const { crearPadronRoutes } = require("./padronRoutes");

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// Herramientas del personal autorizado (Capital Humano, salud laboral).
// Cada servicio aplica el ámbito (repartición) de los roles del actor.
function crearGestionRoutes(deps) {
  const { dbs, cifrador } = deps;
  const correcciones = crearServicioCorrecciones(dbs, cifrador);
  const router = Router();
  router.use(requiereSesion(deps));

  router.use(crearPadronRoutes(deps));

  // Bandeja de correcciones de los empleados sobre su ficha.
  router.get(
    "/correcciones",
    query("estado").optional().isIn(["pendientes", "todas"]),
    validarCampos,
    manejar(async (req, res) => {
      const resultado = await correcciones.listar(req.actor, { soloPendientes: req.query.estado !== "todas" });
      await registrarAuditoria(dbs.admin, {
        actor: req.actor,
        accion: "leer",
        recurso: "correcciones",
        resultado: "permitido",
        detalle: `${resultado.correcciones.length} registros`,
        ip: req.ip,
      });
      res.json(resultado);
    })
  );

  router.get("/correcciones/pendientes", manejar(async (req, res) => {
    res.json({ cantidad: await correcciones.contarPendientes(req.actor) });
  }));

  router.post(
    "/correcciones/:id/resolucion",
    body("decision").isIn(["revisada", "revertir"]).withMessage("Decisión inválida"),
    body("nota").optional({ values: "falsy" }).isString().trim().isLength({ max: 300 }).withMessage("La nota admite hasta 300 caracteres"),
    validarCampos,
    manejar(async (req, res) => {
      const { correccion, idPersona } = await correcciones.resolver(req.actor, req.params.id, req.body);
      await registrarAuditoria(dbs.admin, {
        actor: req.actor,
        accion: req.body.decision === "revertir" ? "revertir" : "revisar",
        recurso: correccion.tipo === "clinica" ? "correcciones_clinicas" : "correcciones_ficha",
        id_persona_titular: idPersona,
        resultado: "permitido",
        detalle: `correccion ${correccion.id}`,
        ip: req.ip,
      });
      res.json(correccion);
    })
  );

  return router;
}

module.exports = { crearGestionRoutes };
