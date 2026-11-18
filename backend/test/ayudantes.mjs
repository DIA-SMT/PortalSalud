import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";

// Los módulos del backend son CommonJS: se cargan con require nativo.
const require = createRequire(import.meta.url);
const { cargarConfig } = require("../src/config/entorno");
const { crearConexiones, migrar, cerrar } = require("../src/config/db");
const { crearIdentidad } = require("../src/servicios/identidad");
const { crearCifrador } = require("../src/servicios/cifrado");
const { crearAlmacenamiento } = require("../src/servicios/almacenamiento");
const { crearApp } = require("../src/app");
const { sembrar } = require("../db/seeds/datosFicticios");

export const ENV_PRUEBA = {
  NODE_ENV: "test",
  IDENTIDAD_MODO: "simulado",
  DB_CLIENTE: "better-sqlite3",
  DB_ADMIN_ARCHIVO: ":memory:",
  DB_CLINICA_ARCHIVO: ":memory:",
  CLAVE_CIFRADO_CLINICA: crypto.randomBytes(32).toString("base64"),
};

export async function crearEntornoPrueba({ sembrarDatos = true, env = {}, fetchImpl } = {}) {
  // Cada entorno guarda sus archivos en una carpeta temporal propia.
  const documentosDir = await fs.mkdtemp(path.join(os.tmpdir(), "portal-salud-docs-"));
  const config = cargarConfig({ ...ENV_PRUEBA, DOCUMENTOS_DIR: documentosDir, ...env });
  const dbs = crearConexiones(config.db);
  await migrar(dbs);
  const cifrador = crearCifrador(config.claveCifrado);
  const almacenamiento = crearAlmacenamiento(config.documentosDir, cifrador);
  if (sembrarDatos) await sembrar(dbs, cifrador, { almacenamiento });
  const { app } = crearApp({ config, dbs, identidad: crearIdentidad(config.identidad), registrarAccesos: false, fetchImpl });
  return {
    app,
    dbs,
    config,
    cifrador,
    cerrar: async () => {
      await cerrar(dbs);
      await fs.rm(documentosDir, { recursive: true, force: true });
    },
  };
}

// Inicia sesión como una persona ficticia y devuelve un agente con la cookie.
export async function ingresarComo(app, idPersona) {
  const agente = request.agent(app);
  const res = await agente
    .post("/api/sesion")
    .set("x-portal-salud", "1")
    .send({ token: `simulado:${idPersona}` });
  if (res.status !== 201) throw new Error(`No se pudo ingresar como ${idPersona}: ${res.status}`);
  return agente;
}

export { request, require };
