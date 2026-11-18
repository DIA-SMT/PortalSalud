const crypto = require("crypto");

const VERSION = "v1";
const ALGORITMO = "aes-256-gcm";

// Cifrado a nivel de aplicación para campos clínicos (sufijo _cif).
// Formato: v1.<iv>.<tag>.<texto cifrado>, todo en base64url.
// La versión permite rotar la clave o el algoritmo sin romper datos viejos.
function crearCifrador(clave) {
  if (!Buffer.isBuffer(clave) || clave.length !== 32) {
    throw new Error("La clave de cifrado debe ser de 32 bytes");
  }

  const cifrar = (texto) => {
    if (texto === null || texto === undefined) return null;
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv(ALGORITMO, clave, iv);
    const datos = Buffer.concat([cifrador.update(String(texto), "utf8"), cifrador.final()]);
    const tag = cifrador.getAuthTag();
    return [VERSION, iv, tag, datos].map((p) => (Buffer.isBuffer(p) ? p.toString("base64url") : p)).join(".");
  };

  const descifrar = (valor) => {
    if (valor === null || valor === undefined) return null;
    const [version, iv, tag, datos] = String(valor).split(".");
    if (version !== VERSION || !iv || !tag || datos === undefined) {
      throw new Error("Formato de dato cifrado desconocido");
    }
    const descifrador = crypto.createDecipheriv(ALGORITMO, clave, Buffer.from(iv, "base64url"));
    descifrador.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      descifrador.update(Buffer.from(datos, "base64url")),
      descifrador.final(),
    ]).toString("utf8");
  };

  // Archivos: [versión (1 byte)][iv (12)][tag (16)][datos cifrados].
  const VERSION_BINARIA = 1;
  const cifrarBuffer = (buffer) => {
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv(ALGORITMO, clave, iv);
    const datos = Buffer.concat([cifrador.update(buffer), cifrador.final()]);
    return Buffer.concat([Buffer.from([VERSION_BINARIA]), iv, cifrador.getAuthTag(), datos]);
  };

  const descifrarBuffer = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 29 || buffer[0] !== VERSION_BINARIA) {
      throw new Error("Formato de archivo cifrado desconocido");
    }
    const descifrador = crypto.createDecipheriv(ALGORITMO, clave, buffer.subarray(1, 13));
    descifrador.setAuthTag(buffer.subarray(13, 29));
    return Buffer.concat([descifrador.update(buffer.subarray(29)), descifrador.final()]);
  };

  return { cifrar, descifrar, cifrarBuffer, descifrarBuffer };
}

module.exports = { crearCifrador };
