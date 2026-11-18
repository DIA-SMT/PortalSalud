import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo } from "./ayudantes.mjs";

describe("Dashboard Mi Salud", () => {
  let entorno;
  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
  });
  afterAll(() => entorno.cerrar());

  it("arma el resumen del titular con estados derivados", async () => {
    const agente = await ingresarComo(entorno.app, 900001);
    const res = await agente.get("/api/salud/mi-resumen");
    expect(res.status).toBe(200);

    expect(res.body.proximoControl).toMatchObject({ tipo: "Examen periódico anual", estado: "programado" });
    // Un pendiente + un programado con fecha pasada (se muestra como vencido).
    expect(res.body.controlesPendientes.cantidad).toBe(2);
    expect(res.body.controlesPendientes.items.map((c) => c.estado).sort()).toEqual(["pendiente", "vencido"]);
    expect(res.body.ultimosControles).toHaveLength(2);
    expect(res.body.documentos).toEqual({ disponibles: 2, pendientesValidacion: 1 });
    expect(res.body.recordatorios).toHaveLength(2);
    expect(res.body.completitud.porcentaje).toBe(75); // falta "medios de contacto"
  });

  it("nunca expone contenido clínico en el resumen", async () => {
    const agente = await ingresarComo(entorno.app, 900001);
    const texto = JSON.stringify((await agente.get("/api/salud/mi-resumen")).body);
    expect(texto).not.toMatch(/Alergia ficticia|Obra social ficticia|0\+/);
  });

  it("no mezcla datos de otro empleado (acceso horizontal)", async () => {
    const agente = await ingresarComo(entorno.app, 900002);
    const res = await agente.get("/api/salud/mi-resumen");
    expect(res.status).toBe(200);
    expect(res.body.proximoControl.tipo).toBe("Examen de riesgo específico");
    expect(res.body.recordatorios.map((r) => r.titulo)).toEqual(["Turno de Martín"]);
    expect(res.body.documentos).toEqual({ disponibles: 0, pendientesValidacion: 0 });
    expect(JSON.stringify(res.body)).not.toMatch(/Lucía|agudeza|Contacto Ficticio/);
  });

  it("ignora intentos de elegir el titular por parámetro", async () => {
    const agente = await ingresarComo(entorno.app, 900002);
    const res = await agente.get("/api/salud/mi-resumen?id_persona=900001");
    expect(res.body.proximoControl.tipo).toBe("Examen de riesgo específico");
  });

  it("muestra estados vacíos para quien no tiene datos", async () => {
    const agente = await ingresarComo(entorno.app, 900005);
    const res = await agente.get("/api/salud/mi-resumen");
    expect(res.body).toMatchObject({
      proximoControl: null,
      controlesPendientes: { cantidad: 0, items: [] },
      ultimosControles: [],
      recordatorios: [],
      completitud: { porcentaje: 0 },
    });
  });
});
