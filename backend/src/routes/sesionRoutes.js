const { Router } = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { validarCampos } = require("../middlewares/errores");
const { requiereSesion } = require("../middlewares/sesion");
const { registrarAuditoria } = require("../servicios/auditoria");

const datosUsuario = (identidad) => ({
  nombre: identidad.nombre,
  apellido: identidad.apellido,
  legajo: identidad.legajo,
  reparticion: identidad.reparticion,
});

function crearSesionRoutes(deps) {
  const { identidad, sesiones, dbs, config, padron } = deps;
  const router = Router();

  const opcionesCookie = {
    httpOnly: true,
    secure: config.sesion.cookieSegura,
    sameSite: "strict",
    path: "/",
  };

  const limiteIngreso = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Demasiados intentos de ingreso. Esperá unos minutos." },
  });

  // Canje del token de CiDiTuc por una sesión propia del portal.
  router.post(
    "/",
    limiteIngreso,
    body("token").isString().withMessage("Falta el token de ingreso").isLength({ min: 8, max: 4096 }),
    validarCampos,
    async (req, res, next) => {
      try {
        const persona = await identidad.validarToken(req.body.token);
        // Vincula la cuenta con el padrón de RRHH (y lo cargado con id provisorio) al ingresar.
        await padron.vincular(persona);
        const { token, expiraEn } = await sesiones.crear(persona);
        await registrarAuditoria(dbs.admin, {
          actor: { id_persona: persona.id_persona },
          accion: "iniciar",
          recurso: "sesion",
          id_persona_titular: persona.id_persona,
          resultado: "permitido",
          detalle: `modo=${identidad.modo}`,
          ip: req.ip,
        });
        res.cookie(config.sesion.nombreCookie, token, { ...opcionesCookie, expires: expiraEn });
        res.status(201).json({ usuario: datosUsuario(persona) });
      } catch (error) {
        await registrarAuditoria(dbs.admin, {
          accion: "iniciar",
          recurso: "sesion",
          resultado: error.code === 401 ? "denegado" : "error",
          detalle: error.code === 401 ? "token no validado" : "servicio de identidad no disponible",
          ip: req.ip,
        });
        next(error);
      }
    }
  );

  router.get("/", requiereSesion(deps), (req, res) => {
    res.json({
      usuario: datosUsuario(req.actor.identidad),
      roles: [...new Set(req.actor.roles.map((r) => r.rol))],
    });
  });

  router.delete("/", requiereSesion(deps), async (req, res, next) => {
    try {
      await sesiones.cerrar(req.tokenSesion);
      await registrarAuditoria(dbs.admin, {
        actor: req.actor,
        accion: "cerrar",
        recurso: "sesion",
        id_persona_titular: req.actor.id_persona,
        resultado: "permitido",
        ip: req.ip,
      });
      res.clearCookie(config.sesion.nombreCookie, opcionesCookie);
      res.json({ redireccion: config.identidad.ciditucLogoutUrl });
    } catch (error) {
      next(error);
    }
  });

  // Solo en modo simulado: lista de personas ficticias para la pantalla de ingreso de desarrollo.
  if (identidad.modo === "simulado") {
    router.get("/simulado/personas", (_req, res) => {
      res.json({
        personas: identidad.personas.map((p) => ({
          token: `simulado:${p.id_persona}`,
          nombre: `${p.nombre_persona} ${p.apellido_persona}`,
          reparticion: p.nombre_reparticion || "—",
          descripcion: p.descripcion,
        })),
      });
    });
  }

  return router;
}

module.exports = { crearSesionRoutes };
