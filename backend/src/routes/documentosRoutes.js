const { Router } = require("express");
const multer = require("multer");
const { body } = require("express-validator");
const CustomError = require("../utils/CustomError");
const { validarCampos } = require("../middlewares/errores");
const { autorizar, contextoPropio } = require("../middlewares/sesion");
const { registrarAuditoria } = require("../servicios/auditoria");
const { TIPOS_DOCUMENTO } = require("../servicios/documentos");
const { TAMANO_MAXIMO } = require("../servicios/validacionArchivos");
const { obtenerHistorial } = require("../servicios/historial");

// El archivo se recibe en memoria (máximo 5 MB, uno solo) y se valida antes de guardarlo.
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 5 },
}).single("archivo");

const recibirArchivo = (req, res, next) =>
  subida(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return next(new CustomError("El archivo supera los 5 MB permitidos.", 413));
    return next(new CustomError("No pudimos recibir el archivo.", 400));
  });

// Nombre para Content-Disposition (RFC 5987), sin caracteres que rompan el encabezado.
const disposicion = (nombre) => {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
};

function crearDocumentosRoutes(deps, { documentos, controles }) {
  const { dbs } = deps;
  const router = Router();

  const leerPropios = autorizar(deps, "leer", "datos_propios", contextoPropio);
  const leerClinicos = autorizar(deps, "leer", "datos_clinicos", contextoPropio);
  const editarPropios = autorizar(deps, "editar", "datos_propios", contextoPropio);
  const declararClinicos = autorizar(deps, "declarar", "datos_clinicos", contextoPropio);

  const auditar = (req, accion, detalle, resultado = "permitido") =>
    registrarAuditoria(dbs.admin, {
      actor: req.actor,
      accion,
      recurso: "documentos",
      id_persona_titular: req.actor.id_persona,
      resultado,
      detalle,
      ip: req.ip,
    });

  const manejar = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };

  // Lista documentos propios, incluidos los clínicos (títulos descifrados).
  router.get("/documentos", leerClinicos, manejar(async (req, res) => {
    const lista = await documentos.listar(req.actor.id_persona);
    await auditar(req, "leer", "listado propio");
    res.json({ documentos: lista, tipos: TIPOS_DOCUMENTO });
  }));

  // Subida: la autorización depende de si el tipo es clínico o administrativo.
  router.post(
    "/documentos",
    recibirArchivo,
    body("tipo").isIn(Object.keys(TIPOS_DOCUMENTO)).withMessage("Elegí el tipo de documento"),
    body("titulo").isString().trim().isLength({ min: 3, max: 160 }).withMessage("Poné un título de 3 a 160 caracteres"),
    body("idControl").optional({ values: "falsy" }).isInt({ min: 1 }).toInt(),
    validarCampos,
    (req, res, next) =>
      (TIPOS_DOCUMENTO[req.body.tipo].clasificacion === "clinico" ? declararClinicos : editarPropios)(req, res, next),
    manejar(async (req, res) => {
      try {
        const doc = await documentos.subir(req.actor.id_persona, {
          archivo: req.file,
          tipo: req.body.tipo,
          titulo: req.body.titulo,
          idControl: req.body.idControl,
        });
        await auditar(req, "subir", `documento ${doc.id} (${doc.clasificacion})`);
        res.status(201).json(doc);
      } catch (error) {
        if (error.code >= 400 && error.code < 500) await auditar(req, "subir", "archivo rechazado", "denegado");
        throw error;
      }
    })
  );

  router.get("/documentos/:id/descarga", leerClinicos, manejar(async (req, res) => {
    const { contenido, mime, nombre } = await documentos.descargar(req.actor.id_persona, req.params.id);
    await auditar(req, "descargar", `documento ${req.params.id}`);
    res.set({
      "Content-Type": mime,
      "Content-Length": contenido.length,
      "Content-Disposition": disposicion(nombre),
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(contenido);
  }));

  router.delete("/documentos/:id", leerClinicos, manejar(async (req, res) => {
    await documentos.eliminar(req.actor.id_persona, req.params.id);
    await auditar(req, "retirar", `documento ${req.params.id}`);
    res.status(204).end();
  }));

  // Línea de tiempo: controles, documentos y pedidos de reprogramación.
  router.get("/historial", leerPropios, leerClinicos, manejar(async (req, res) => {
    res.json({ eventos: await obtenerHistorial({ controles, documentos }, req.actor.id_persona) });
  }));

  return router;
}

module.exports = { crearDocumentosRoutes };
