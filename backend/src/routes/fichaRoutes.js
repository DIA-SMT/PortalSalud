const { Router } = require("express");
const { body, param } = require("express-validator");
const { validarCampos } = require("../middlewares/errores");
const { autorizar, contextoPropio } = require("../middlewares/sesion");
const { registrarAuditoria } = require("../servicios/auditoria");
const { crearServicioFicha, CATEGORIAS, GRUPOS_SANGUINEOS } = require("../servicios/ficha");

const TELEFONO = /^[0-9+()\-\s]{6,30}$/;
const MSJ_TELEFONO = "Ingresá un teléfono válido (solo números, espacios, +, - o paréntesis)";

const reglasContactoEmergencia = [
  body("nombre").isString().trim().isLength({ min: 2, max: 120 }).withMessage("Ingresá el nombre del contacto (2 a 120 caracteres)"),
  body("vinculo").isString().trim().isLength({ min: 2, max: 60 }).withMessage("Indicá el vínculo (por ejemplo: madre, pareja, amigo)"),
  body("telefono").isString().trim().matches(TELEFONO).withMessage(MSJ_TELEFONO),
  body("telefonoAlternativo").optional({ values: "falsy" }).isString().trim().matches(TELEFONO).withMessage(MSJ_TELEFONO),
  body("prioridad").optional().isInt({ min: 1, max: 5 }).toInt(),
  validarCampos,
];

const idValido = [param("id").isInt({ min: 1 }).withMessage("Identificador inválido").toInt(), validarCampos];

const descripcion = body("descripcion")
  .isString()
  .trim()
  .isLength({ min: 2, max: 500 })
  .withMessage("Escribí una descripción de 2 a 500 caracteres");

// Ficha de salud del titular de la sesión. Ninguna ruta acepta un id de persona.
function crearFichaRoutes(deps) {
  const { dbs, cifrador } = deps;
  const ficha = crearServicioFicha(dbs, cifrador);
  const router = Router();

  const leerPropios = autorizar(deps, "leer", "datos_propios", contextoPropio);
  const editarPropios = autorizar(deps, "editar", "datos_propios", contextoPropio);
  const leerClinicos = autorizar(deps, "leer", "datos_clinicos", contextoPropio);
  const declararClinicos = autorizar(deps, "declarar", "datos_clinicos", contextoPropio);

  // Toda lectura o escritura clínica queda auditada (sin contenido).
  const auditar = (req, accion, recurso, detalle) =>
    registrarAuditoria(dbs.admin, {
      actor: req.actor,
      accion,
      recurso,
      id_persona_titular: req.actor.id_persona,
      resultado: "permitido",
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

  // ---------- Datos personales, contacto y laborales ----------
  router.get("/", leerPropios, manejar(async (req, res) => {
    res.json(await ficha.obtenerAdministrativa(req.actor.identidad));
  }));

  router.put(
    "/contacto",
    editarPropios,
    body("telefonoAlternativo").optional({ values: "falsy" }).isString().trim().matches(TELEFONO).withMessage(MSJ_TELEFONO),
    body("emailAlternativo").optional({ values: "falsy" }).isString().trim().isEmail().withMessage("Ingresá un correo válido").isLength({ max: 120 }),
    validarCampos,
    manejar(async (req, res) => {
      res.json(await ficha.guardarContacto(req.actor.identidad, req.body));
    })
  );

  // Área, puesto y actividad: los carga Capital Humano; el empleado corrige con revisión posterior.
  router.put(
    "/laboral",
    editarPropios,
    body(["area", "puesto"]).optional({ values: "null" }).isString().trim().isLength({ max: 160 }).withMessage("Hasta 160 caracteres"),
    body("actividad").optional({ values: "null" }).isString().trim().isLength({ max: 240 }).withMessage("Hasta 240 caracteres"),
    validarCampos,
    manejar(async (req, res) => {
      res.json(await ficha.guardarLaboral(req.actor.identidad, req.body));
    })
  );

  router.post("/contactos-emergencia", editarPropios, reglasContactoEmergencia, manejar(async (req, res) => {
    res.status(201).json(await ficha.crearContactoEmergencia(req.actor.id_persona, req.body));
  }));

  router.put("/contactos-emergencia/:id", editarPropios, idValido, reglasContactoEmergencia, manejar(async (req, res) => {
    res.json(await ficha.actualizarContactoEmergencia(req.actor.id_persona, req.params.id, req.body));
  }));

  router.delete("/contactos-emergencia/:id", editarPropios, idValido, manejar(async (req, res) => {
    await ficha.eliminarContactoEmergencia(req.actor.id_persona, req.params.id);
    res.status(204).end();
  }));

  // ---------- Información de salud (esquema clínico) ----------
  router.get("/salud", leerClinicos, manejar(async (req, res) => {
    const datos = await ficha.obtenerClinica(req.actor.id_persona);
    await auditar(req, "leer", "datos_clinicos", "ficha de salud");
    res.json(datos);
  }));

  router.put(
    "/salud/cobertura",
    declararClinicos,
    body("cobertura").optional({ values: "null" }).isString().trim().isLength({ max: 160 }).withMessage("La cobertura admite hasta 160 caracteres"),
    validarCampos,
    manejar(async (req, res) => {
      const resultado = await ficha.guardarCobertura(req.actor.identidad, req.body.cobertura);
      await auditar(req, "declarar", "datos_clinicos", "cobertura");
      res.json(resultado);
    })
  );

  router.put(
    "/salud/grupo-sanguineo",
    declararClinicos,
    body("grupoSanguineo").isIn(GRUPOS_SANGUINEOS).withMessage("Elegí un grupo sanguíneo válido"),
    validarCampos,
    manejar(async (req, res) => {
      const resultado = await ficha.guardarGrupoSanguineo(req.actor.identidad, req.body.grupoSanguineo);
      await auditar(req, "declarar", "datos_clinicos", "grupo sanguíneo");
      res.json(resultado);
    })
  );

  router.post(
    "/salud/declaraciones",
    declararClinicos,
    body("categoria").isIn(CATEGORIAS).withMessage("Categoría inválida"),
    descripcion,
    validarCampos,
    manejar(async (req, res) => {
      const creada = await ficha.crearDeclaracion(req.actor.identidad, req.body);
      await auditar(req, "declarar", "datos_clinicos", `declaracion id=${creada.id}`);
      res.status(201).json(creada);
    })
  );

  router.put("/salud/declaraciones/:id", declararClinicos, idValido, descripcion, validarCampos, manejar(async (req, res) => {
    const actualizada = await ficha.actualizarDeclaracion(req.actor.identidad, req.params.id, req.body);
    await auditar(req, "declarar", "datos_clinicos", `declaracion id=${req.params.id} modificada`);
    res.json(actualizada);
  }));

  router.delete("/salud/declaraciones/:id", declararClinicos, idValido, manejar(async (req, res) => {
    await ficha.darDeBajaDeclaracion(req.actor.identidad, req.params.id);
    await auditar(req, "declarar", "datos_clinicos", `declaracion id=${req.params.id} dada de baja`);
    res.status(204).end();
  }));

  return router;
}

module.exports = { crearFichaRoutes };
