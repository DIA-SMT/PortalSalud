const CustomError = require("../utils/CustomError");
const { obtenerRolesVigentes } = require("../servicios/roles");
const { puede } = require("../politicas/politicas");
const { registrarAuditoria } = require("../servicios/auditoria");

// Carga la sesión desde la cookie y arma `req.actor`. El titular de cualquier
// operación sale de acá, nunca de parámetros enviados por el cliente.
const requiereSesion = ({ sesiones, dbs, config }) => async (req, _res, next) => {
  try {
    const token = req.cookies?.[config.sesion.nombreCookie];
    const sesion = token ? await sesiones.obtener(token) : null;
    if (!sesion) throw new CustomError("Tu sesión venció. Volvé a ingresar desde Ciudad Digital.", 401);

    const { identidad } = sesion;
    req.tokenSesion = token;
    req.actor = {
      id_persona: identidad.id_persona,
      id_reparticion: identidad.id_reparticion,
      identidad,
      roles: await obtenerRolesVigentes(dbs.admin, identidad.id_persona),
    };
    next();
  } catch (error) {
    next(error);
  }
};

// Autoriza según las políticas. `obtenerContexto(req)` arma el contexto con datos
// del servidor (p. ej. la repartición del titular), no con lo que diga el cliente.
const autorizar = ({ dbs }, accion, recurso, obtenerContexto) => async (req, _res, next) => {
  try {
    const contexto = await obtenerContexto(req);
    if (!puede(req.actor, accion, recurso, contexto)) {
      await registrarAuditoria(dbs.admin, {
        actor: req.actor,
        accion,
        recurso,
        id_persona_titular: contexto?.id_persona_titular,
        resultado: "denegado",
        ip: req.ip,
      });
      throw new CustomError("No tenés permiso para realizar esta acción.", 403);
    }
    req.contexto = contexto;
    next();
  } catch (error) {
    next(error);
  }
};

// Contexto para operaciones sobre los datos de quien tiene la sesión.
const contextoPropio = (req) => ({
  id_persona_titular: req.actor.id_persona,
  id_reparticion_titular: req.actor.id_reparticion,
});

module.exports = { requiereSesion, autorizar, contextoPropio };
