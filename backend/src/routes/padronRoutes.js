const { Router } = require("express");
const multer = require("multer");
const { body, query } = require("express-validator");
const CustomError = require("../utils/CustomError");
const { validarCampos } = require("../middlewares/errores");
const { registrarAuditoria } = require("../servicios/auditoria");
const { puede, ROLES } = require("../politicas/politicas");

const ROLES_PADRON = [ROLES.RECURSOS_HUMANOS, ROLES.CAPITAL_HUMANO_SALUD, ROLES.COORDINADOR_SALUD];

const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 5 } }).single("archivo");
const recibirArchivo = (req, res, next) =>
  subida(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return next(new CustomError("El archivo supera los 2 MB permitidos.", 413));
    return next(new CustomError("No pudimos recibir el archivo.", 400));
  });

const exigir = (accion, recurso) => (req, _res, next) =>
  puede(req.actor, accion, recurso) ? next() : next(new CustomError("No tenés permiso para esta acción.", 403));

// Reparticiones que alcanza el actor en el padrón (null = todas).
const ambitosPadron = (actor) => {
  const propios = actor.roles.filter((r) => ROLES_PADRON.includes(r.rol));
  if (propios.some((r) => (r.ambito_id_reparticion ?? null) === null)) return null;
  return propios.map((r) => r.ambito_id_reparticion);
};

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// Padrón de empleados (RRHH). Se monta dentro de /api/gestion, que ya exige sesión.
function crearPadronRoutes({ dbs, padron, fuentes }) {
  const router = Router();
  const auditar = (req, accion, detalle) =>
    registrarAuditoria(dbs.admin, { actor: req.actor, accion, recurso: "padron", resultado: "permitido", detalle, ip: req.ip });

  router.get(
    "/padron",
    exigir("leer", "padron"),
    query("buscar").optional().isString().isLength({ max: 80 }),
    query("pagina").optional().isInt({ min: 1, max: 10000 }).toInt(),
    validarCampos,
    manejar(async (req, res) => {
      res.json(await padron.buscar({ texto: req.query.buscar, pagina: req.query.pagina || 1, ambitos: ambitosPadron(req.actor) }));
    })
  );

  router.get("/padron/plantilla", exigir("leer", "padron"), (_req, res) => {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-padron-empleados.csv"',
    });
    // BOM para que Excel abra bien las tildes.
    res.send(String.fromCharCode(0xfeff) + padron.plantilla() + "\r\n");
  });

  router.get("/padron/importaciones", exigir("importar", "padron"), manejar(async (_req, res) => {
    res.json({ importaciones: await padron.listarImportaciones() });
  }));

  // Previsualiza (confirmar=false) o aplica (confirmar=true) un CSV del padrón.
  router.post(
    "/padron/importaciones",
    exigir("importar", "padron"),
    recibirArchivo,
    body("confirmar").optional().isBoolean().toBoolean(),
    body("padronCompleto").optional().isBoolean().toBoolean(),
    validarCampos,
    manejar(async (req, res) => {
      const resultado = await padron.importarCsv(req.actor, req.file, {
        confirmar: req.body.confirmar === true,
        padronCompleto: req.body.padronCompleto === true,
      });
      await responder(req, res, resultado, "csv");
    })
  );

  // Fuentes de datos disponibles (CSV siempre; las remotas, cuando tengan URL configurada).
  router.get("/padron/fuentes", exigir("leer", "padron"), (_req, res) => {
    res.json({ fuentes: fuentes.listar() });
  });

  // Sincroniza desde una fuente remota (Portal del Empleado, CiDiTuc). Mismo flujo que el
  // CSV: primero previsualiza y recién con confirmar=true aplica.
  router.post(
    "/padron/sincronizaciones",
    exigir("importar", "padron"),
    body("fuente").isIn(["cidituc", "portal_empleado"]).withMessage("Fuente inválida"),
    body("confirmar").optional().isBoolean().toBoolean(),
    body("padronCompleto").optional().isBoolean().toBoolean(),
    validarCampos,
    manejar(async (req, res) => {
      const resultado = await padron.sincronizar(req.actor, fuentes.obtener(req.body.fuente), {
        confirmar: req.body.confirmar === true,
        padronCompleto: req.body.padronCompleto === true,
      });
      await responder(req, res, resultado, req.body.fuente);
    })
  );

  async function responder(req, res, resultado, fuente) {
    if (resultado.confirmado) {
      const r = resultado.resumen;
      await auditar(
        req,
        "importar",
        `importacion ${resultado.idImportacion} (${fuente}): ${r.altas} altas, ${r.actualizaciones} act., ${r.bajas} bajas, ${r.errores} errores`
      );
    }
    res.status(resultado.confirmado ? 201 : 200).json(resultado);
  }

  return router;
}

module.exports = { crearPadronRoutes };
