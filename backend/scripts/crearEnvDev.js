const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Genera backend/.env para desarrollo local (identidad simulada + SQLite)
// con una clave de cifrado aleatoria. No pisa un .env existente.
const destino = path.join(__dirname, "..", ".env");
if (fs.existsSync(destino)) {
  console.log("Ya existe backend/.env; no se modificó.");
  process.exit(0);
}

const plantilla = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
const contenido = plantilla.replace(
  /^CLAVE_CIFRADO_CLINICA=.*$/m,
  `CLAVE_CIFRADO_CLINICA=${crypto.randomBytes(32).toString("base64")}`
);
fs.writeFileSync(destino, contenido, { mode: 0o600 });
console.log("Creado backend/.env de desarrollo (identidad simulada, SQLite).");
