const crypto = require("crypto");
const { aFecha } = require("../utils/fechas");

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const MS_MINUTO = 60 * 1000;

// Sesiones del portal, guardadas en el servidor. En la base solo queda el hash
// del identificador: robar la tabla no permite secuestrar sesiones.
function crearServicioSesiones(dbAdmin, { minutosInactividad, horasMaximas }) {
  const crear = async (identidad, ahora = new Date()) => {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiraEn = new Date(ahora.getTime() + horasMaximas * 60 * MS_MINUTO);
    await dbAdmin("sesion").insert({
      id_hash: hash(token),
      id_persona: identidad.id_persona,
      datos: JSON.stringify(identidad),
      creada_en: ahora,
      ultima_actividad: ahora,
      expira_en: expiraEn,
    });
    return { token, expiraEn };
  };

  const obtener = async (token, ahora = new Date()) => {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
    const idHash = hash(token);
    const fila = await dbAdmin("sesion").where({ id_hash: idHash }).first();
    if (!fila) return null;

    const ultima = aFecha(fila.ultima_actividad);
    const vencida =
      aFecha(fila.expira_en) <= ahora || ultima.getTime() + minutosInactividad * MS_MINUTO <= ahora.getTime();
    if (vencida) {
      await dbAdmin("sesion").where({ id_hash: idHash }).del();
      return null;
    }

    // Renovación por actividad, como máximo una escritura por minuto.
    if (ahora.getTime() - ultima.getTime() > MS_MINUTO) {
      await dbAdmin("sesion").where({ id_hash: idHash }).update({ ultima_actividad: ahora });
    }

    return { identidad: JSON.parse(fila.datos), expiraEn: aFecha(fila.expira_en) };
  };

  const cerrar = async (token) => {
    if (typeof token !== "string") return;
    await dbAdmin("sesion").where({ id_hash: hash(token) }).del();
  };

  const purgarVencidas = async (ahora = new Date()) => {
    const limiteInactividad = new Date(ahora.getTime() - minutosInactividad * MS_MINUTO);
    return dbAdmin("sesion")
      .where("expira_en", "<=", ahora)
      .orWhere("ultima_actividad", "<=", limiteInactividad)
      .del();
  };

  return { crear, obtener, cerrar, purgarVencidas };
}

module.exports = { crearServicioSesiones };
