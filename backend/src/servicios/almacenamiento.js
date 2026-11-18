const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const CustomError = require("../utils/CustomError");

const NOMBRE_VALIDO = /^[0-9a-f-]{36}\.bin$/;

// Almacenamiento privado de archivos: fuera de cualquier carpeta pública, cifrados
// con AES-256-GCM y con nombres aleatorios (el nombre original queda solo en la BD).
// Solo se accede a través de endpoints que validan sesión y permisos.
function crearAlmacenamiento(directorio, cifrador) {
  const rutaDe = (nombre) => {
    if (!NOMBRE_VALIDO.test(nombre)) throw new CustomError("Archivo no disponible", 404);
    return path.join(directorio, nombre);
  };

  const guardar = async (buffer) => {
    await fs.mkdir(directorio, { recursive: true });
    const nombre = `${crypto.randomUUID()}.bin`;
    await fs.writeFile(path.join(directorio, nombre), cifrador.cifrarBuffer(buffer), { mode: 0o600 });
    return { ruta: nombre, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
  };

  const leer = async (nombre) => {
    let contenido;
    try {
      contenido = await fs.readFile(rutaDe(nombre));
    } catch (error) {
      if (error.code === 404) throw error;
      throw new CustomError("El archivo no está disponible. Consultá con el servicio de salud.", 404);
    }
    return cifrador.descifrarBuffer(contenido);
  };

  const eliminar = async (nombre) => {
    try {
      await fs.unlink(rutaDe(nombre));
    } catch {
      // si ya no existe, no hay nada que borrar
    }
  };

  return { guardar, leer, eliminar };
}

module.exports = { crearAlmacenamiento };
