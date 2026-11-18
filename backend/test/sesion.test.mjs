import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo, request } from "./ayudantes.mjs";

describe("Sesión (SSO CiDiTuc simulado)", () => {
  let entorno;
  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
  });
  afterAll(() => entorno.cerrar());

  it("canjea un token válido por una cookie httpOnly y SameSite=Strict", async () => {
    const res = await request(entorno.app)
      .post("/api/sesion")
      .set("x-portal-salud", "1")
      .send({ token: "simulado:900001" });

    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ nombre: "Lucía", legajo: 70001 });
    // Minimización: no se devuelven documento ni email.
    expect(JSON.stringify(res.body)).not.toMatch(/documento|email/i);

    const cookie = res.headers["set-cookie"].join(";");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it("guarda solo el hash del identificador de sesión", async () => {
    const res = await request(entorno.app)
      .post("/api/sesion")
      .set("x-portal-salud", "1")
      .send({ token: "simulado:900002" });
    const valor = res.headers["set-cookie"][0].split(";")[0].split("=")[1];
    const filas = await entorno.dbs.admin("sesion").select("id_hash");
    expect(filas.some((f) => f.id_hash === valor)).toBe(false);
    expect(filas.every((f) => /^[0-9a-f]{64}$/.test(f.id_hash))).toBe(true);
  });

  it("rechaza a quien no es empleado", async () => {
    const res = await request(entorno.app)
      .post("/api/sesion")
      .set("x-portal-salud", "1")
      .send({ token: "simulado:900099" });
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rechaza tokens inválidos y registra el intento en auditoría", async () => {
    const res = await request(entorno.app)
      .post("/api/sesion")
      .set("x-portal-salud", "1")
      .send({ token: "cualquier-cosa" });
    expect(res.status).toBe(401);
    const denegados = await entorno.dbs.admin("auditoria_salud").where({ recurso: "sesion", resultado: "denegado" });
    expect(denegados.length).toBeGreaterThan(0);
    expect(JSON.stringify(denegados)).not.toContain("cualquier-cosa");
  });

  it("bloquea peticiones que modifican datos sin el encabezado anti-CSRF", async () => {
    const res = await request(entorno.app).post("/api/sesion").send({ token: "simulado:900001" });
    expect(res.status).toBe(403);
  });

  it("bloquea peticiones desde otro origen", async () => {
    const res = await request(entorno.app)
      .post("/api/sesion")
      .set("x-portal-salud", "1")
      .set("Origin", "https://sitio-malicioso.test")
      .send({ token: "simulado:900001" });
    expect(res.status).toBe(403);
  });

  it("devuelve la sesión actual con sus roles y permite cerrarla", async () => {
    const agente = await ingresarComo(entorno.app, 900003);
    const yo = await agente.get("/api/sesion");
    expect(yo.status).toBe(200);
    expect(yo.body.roles).toEqual(expect.arrayContaining(["EMPLEADO", "PROFESIONAL_SALUD"]));
    expect(yo.headers["cache-control"]).toBe("no-store");

    const salida = await agente.delete("/api/sesion").set("x-portal-salud", "1");
    expect(salida.status).toBe(200);
    expect(salida.body.redireccion).toContain("logout=true");

    const despues = await agente.get("/api/sesion");
    expect(despues.status).toBe(401);
  });

  it("sin cookie no hay acceso", async () => {
    const res = await request(entorno.app).get("/api/salud/mi-resumen");
    expect(res.status).toBe(401);
  });
});
