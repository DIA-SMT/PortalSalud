const CustomError = require("../../utils/CustomError");
const { PERSONAS_FICTICIAS } = require("./personasFicticias");

const MENSAJE_NO_VALIDADO =
  "No pudimos validar tu acceso como empleado municipal. Volvé a ingresar desde Ciudad Digital.";
const MENSAJE_NO_DISPONIBLE =
  "No pudimos comunicarnos con Ciudad Digital. Intentá de nuevo en unos minutos.";

// Lo único que el portal conserva de la identidad (minimización de datos):
// sin documento, email, domicilio ni teléfono.
const normalizarIdentidad = (u) => ({
  id_persona: Number(u.id_persona),
  nombre: u.nombre_persona || "",
  apellido: u.apellido_persona || "",
  legajo: u.afiliado ?? null,
  id_reparticion: u.id_reparticion ?? null,
  reparticion: u.nombre_reparticion || null,
});

const validarFormatoToken = (token) => {
  if (typeof token !== "string" || token.length < 8 || token.length > 4096) {
    throw new CustomError(MENSAJE_NO_VALIDADO, 401);
  }
};

// Valida el token de CiDiTuc servidor a servidor con /usuarios/authStatusIA,
// que responde 401 tanto si el token es inválido como si la persona no es empleada.
function crearIdentidadCidituc({ ciditucApiUrl, timeoutMs }, fetchImpl = fetch) {
  return {
    modo: "cidituc",
    async validarToken(token) {
      validarFormatoToken(token);
      let respuesta;
      try {
        respuesta = await fetchImpl(`${ciditucApiUrl}/usuarios/authStatusIA`, {
          headers: { Authorization: token, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new CustomError(MENSAJE_NO_DISPONIBLE, 503);
      }
      if (respuesta.status === 401 || respuesta.status === 403) {
        throw new CustomError(MENSAJE_NO_VALIDADO, 401);
      }
      if (!respuesta.ok) throw new CustomError(MENSAJE_NO_DISPONIBLE, 503);

      const cuerpo = await respuesta.json().catch(() => null);
      if (!cuerpo?.user?.id_persona) throw new CustomError(MENSAJE_NO_VALIDADO, 401);
      return normalizarIdentidad(cuerpo.user);
    },
  };
}

// Solo desarrollo y pruebas: el token es "simulado:<id_persona>".
function crearIdentidadSimulada() {
  return {
    modo: "simulado",
    personas: PERSONAS_FICTICIAS,
    async validarToken(token) {
      validarFormatoToken(token);
      const [prefijo, id] = token.split(":");
      const persona = PERSONAS_FICTICIAS.find((p) => prefijo === "simulado" && String(p.id_persona) === id);
      if (!persona || persona.noEsEmpleado) throw new CustomError(MENSAJE_NO_VALIDADO, 401);
      return normalizarIdentidad(persona);
    },
  };
}

function crearIdentidad(configIdentidad, fetchImpl) {
  return configIdentidad.modo === "simulado"
    ? crearIdentidadSimulada()
    : crearIdentidadCidituc(configIdentidad, fetchImpl);
}

module.exports = { crearIdentidad, crearIdentidadCidituc, crearIdentidadSimulada, normalizarIdentidad };
