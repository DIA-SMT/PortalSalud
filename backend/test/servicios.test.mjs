import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { require, ENV_PRUEBA } from "./ayudantes.mjs";

const { crearCifrador } = require("../src/servicios/cifrado");
const { crearIdentidadCidituc } = require("../src/servicios/identidad");
const { cargarConfig } = require("../src/config/entorno");

describe("Cifrado de campos clínicos", () => {
  const cifrador = crearCifrador(crypto.randomBytes(32));

  it("cifra y descifra, con IV distinto en cada operación", () => {
    const a = cifrador.cifrar("Alergia a la penicilina");
    const b = cifrador.cifrar("Alergia a la penicilina");
    expect(a).not.toBe(b);
    expect(a).not.toContain("penicilina");
    expect(cifrador.descifrar(a)).toBe("Alergia a la penicilina");
  });

  it("detecta datos alterados o cifrados con otra clave", () => {
    const valor = cifrador.cifrar("dato");
    const partes = valor.split(".");
    partes[3] = Buffer.from("otro").toString("base64url");
    expect(() => cifrador.descifrar(partes.join("."))).toThrow();
    expect(() => crearCifrador(crypto.randomBytes(32)).descifrar(valor)).toThrow();
  });
});

describe("Identidad CiDiTuc (authStatusIA)", () => {
  const conRespuesta = (status, cuerpo) => async (url, opciones) => {
    conRespuesta.ultima = { url, opciones };
    return { status, ok: status >= 200 && status < 300, json: async () => cuerpo };
  };
  const identidad = (fetchImpl) =>
    crearIdentidadCidituc({ ciditucApiUrl: "https://api.ejemplo.test", timeoutMs: 1000 }, fetchImpl);

  it("normaliza el empleado y conserva solo los datos necesarios", async () => {
    const fetchImpl = conRespuesta(200, {
      user: {
        id_persona: 5, afiliado: 123, id_reparticion: 7, nombre_reparticion: "Rep",
        nombre_persona: "Ana", apellido_persona: "Test", documento_persona: 20111111112, email_persona: "a@ejemplo.test",
      },
    });
    const persona = await identidad(fetchImpl).validarToken("token-de-prueba");
    expect(persona).toEqual({ id_persona: 5, nombre: "Ana", apellido: "Test", legajo: 123, id_reparticion: 7, reparticion: "Rep" });
    expect(conRespuesta.ultima.url).toBe("https://api.ejemplo.test/usuarios/authStatusIA");
    expect(conRespuesta.ultima.opciones.headers.Authorization).toBe("token-de-prueba");
  });

  it("traduce 401 (token inválido o no empleado) a 401", async () => {
    await expect(identidad(conRespuesta(401, {})).validarToken("token-de-prueba")).rejects.toMatchObject({ code: 401 });
  });

  it("traduce fallas de red o del servicio a 503", async () => {
    const caido = async () => { throw new Error("ECONNREFUSED"); };
    await expect(identidad(caido).validarToken("token-de-prueba")).rejects.toMatchObject({ code: 503 });
    await expect(identidad(conRespuesta(500, {})).validarToken("token-de-prueba")).rejects.toMatchObject({ code: 503 });
  });
});

describe("Configuración", () => {
  it("impide la identidad simulada y SQLite en producción", () => {
    expect(() => cargarConfig({ ...ENV_PRUEBA, NODE_ENV: "production" })).toThrow(/simulado.*producción/s);
  });

  it("exige la clave de cifrado de 32 bytes", () => {
    expect(() => cargarConfig({ ...ENV_PRUEBA, CLAVE_CIFRADO_CLINICA: "corta" })).toThrow(/CLAVE_CIFRADO_CLINICA/);
  });

  it("en modo cidituc exige la URL del backend", () => {
    expect(() => cargarConfig({ ...ENV_PRUEBA, IDENTIDAD_MODO: "cidituc" })).toThrow(/CIDITUC_API_URL/);
  });
});
