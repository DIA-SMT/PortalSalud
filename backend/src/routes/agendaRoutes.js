const { Router } = require("express");
const { body, param, query } = require("express-validator");
const { validarCampos } = require("../middlewares/errores");
const { registrarAuditoria } = require("../servicios/auditoria");
const { crearServicioAgenda } = require("../servicios/agenda");

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fecha = (campo, { opcional = false } = {}) => {
  const regla = body(campo);
  return (opcional ? regla.optional({ values: "falsy" }) : regla)
    .matches(FECHA)
    .withMessage("Fecha inválida (AAAA-MM-DD)")
    .bail()
    .custom((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)))
    .withMessage("Fecha inválida");
};
const idValido = [param("id").isInt({ min: 1 }).withMessage("Identificador inválido").toInt(), validarCampos];
const textoOpcional = (campo, max) =>
  body(campo).optional({ values: "null" }).isString().trim().isLength({ max }).withMessage(`Hasta ${max} caracteres`);

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// Agenda de controles del personal de salud laboral. Se monta en /api/gestion (con sesión).
// El servicio aplica el ámbito: profesionales en sus reparticiones, coordinación en todas.
function crearAgendaRoutes(deps) {
  const { dbs, padron } = deps;
  const agenda = crearServicioAgenda(dbs, { padron });
  const router = Router();

  const auditar = (req, accion, idPersona, detalle) =>
    registrarAuditoria(dbs.admin, {
      actor: req.actor,
      accion,
      recurso: "agenda_controles",
      id_persona_titular: idPersona,
      resultado: "permitido",
      detalle,
      ip: req.ip,
    });

  router.get(
    "/agenda",
    query(["desde", "hasta"]).optional().matches(FECHA),
    query("estado").optional().isIn(["programado", "pendiente", "realizado", "reprogramado", "vencido", "cancelado"]),
    query("buscar").optional().isString().isLength({ max: 80 }),
    validarCampos,
    manejar(async (req, res) => {
      res.json(await agenda.listar(req.actor, req.query));
    })
  );

  router.get(
    "/agenda/empleados",
    query("buscar").optional().isString().isLength({ max: 80 }),
    validarCampos,
    manejar(async (req, res) => {
      res.json(await agenda.buscarEmpleados(req.actor, req.query.buscar || ""));
    })
  );

  router.post(
    "/agenda",
    body("legajo").isInt({ min: 1 }).withMessage("Elegí un empleado").toInt(),
    body("tipo").isString().trim().isLength({ min: 3, max: 80 }).withMessage("Indicá el tipo de control (3 a 80 caracteres)"),
    fecha("fechaProgramada", { opcional: true }),
    textoOpcional("lugar", 160),
    textoOpcional("responsable", 160),
    validarCampos,
    manejar(async (req, res) => {
      const { id, idPersona } = await agenda.crear(req.actor, req.body);
      await auditar(req, "crear", idPersona, `control ${id}`);
      res.status(201).json({ id });
    })
  );

  router.post(
    "/agenda/:id/reprogramacion",
    idValido,
    fecha("fechaProgramada"),
    textoOpcional("lugar", 160),
    textoOpcional("responsable", 160),
    validarCampos,
    manejar(async (req, res) => {
      const { idPersona } = await agenda.reprogramar(req.actor, req.params.id, req.body);
      await auditar(req, "reprogramar", idPersona, `control ${req.params.id}`);
      res.json({ ok: true });
    })
  );

  router.post(
    "/agenda/:id/realizado",
    idValido,
    fecha("fechaRealizacion"),
    fecha("proximaRevision", { opcional: true }),
    validarCampos,
    manejar(async (req, res) => {
      const { idPersona } = await agenda.registrarRealizado(req.actor, req.params.id, req.body);
      await auditar(req, "registrar_realizado", idPersona, `control ${req.params.id}`);
      res.json({ ok: true });
    })
  );

  router.post("/agenda/:id/cancelacion", idValido, manejar(async (req, res) => {
    const { idPersona } = await agenda.cancelar(req.actor, req.params.id);
    await auditar(req, "cancelar", idPersona, `control ${req.params.id}`);
    res.json({ ok: true });
  }));

  // Pedidos de reprogramación de los empleados.
  router.get("/agenda/pedidos", manejar(async (req, res) => {
    res.json({ pedidos: await agenda.listarPedidos(req.actor) });
  }));

  router.get("/agenda/pedidos/pendientes", manejar(async (req, res) => {
    res.json({ cantidad: await agenda.contarPedidos(req.actor) });
  }));

  router.post(
    "/agenda/pedidos/:id/resolucion",
    idValido,
    body("decision").isIn(["aceptada", "rechazada"]).withMessage("Decisión inválida"),
    fecha("nuevaFecha", { opcional: true }),
    textoOpcional("nota", 200),
    validarCampos,
    manejar(async (req, res) => {
      const { idPersona } = await agenda.resolverPedido(req.actor, req.params.id, req.body);
      await auditar(req, `pedido_${req.body.decision}`, idPersona, `pedido ${req.params.id}`);
      res.json({ ok: true });
    })
  );

  return router;
}

module.exports = { crearAgendaRoutes };
