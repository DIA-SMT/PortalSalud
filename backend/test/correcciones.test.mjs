import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo } from "./ayudantes.mjs";

const H = { "x-portal-salud": "1" };

describe("Bandeja de correcciones (Capital Humano y salud)", () => {
  let entorno;
  let lucia; // empleada
  let martin; // empleado con correcciones pendientes (seed)
  let carla; // RECURSOS_HUMANOS
  let paula; // CAPITAL_HUMANO_SALUD
  let valeria; // PROFESIONAL_SALUD, ámbito Obras
  let tomas; // ADMINISTRADOR_TECNICO

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    [lucia, martin, carla, paula, valeria, tomas] = await Promise.all(
      [900001, 900002, 900005, 900007, 900003, 900006].map((id) => ingresarComo(entorno.app, id))
    );
  });
  afterAll(() => entorno.cerrar());

  it("Recursos Humanos ve solo las correcciones administrativas", async () => {
    const res = await carla.get("/api/gestion/correcciones");
    expect(res.status).toBe(200);
    expect(res.body.puedeRevisar).toEqual({ administrativas: true, clinicas: false });
    expect(res.body.correcciones.map((c) => c.tipo)).toEqual(["administrativa"]);
    expect(res.body.correcciones[0]).toMatchObject({
      campo: "Puesto",
      valorAnterior: "Operario",
      valorNuevo: "Capataz de cuadrilla",
      persona: { nombre: "Martín Prueba", legajo: 70002 },
    });
    expect(JSON.stringify(res.body)).not.toContain("Medicación");
  });

  it("Capital Humano (salud) ve solo las de salud, descifradas", async () => {
    const res = await paula.get("/api/gestion/correcciones");
    expect(res.body.puedeRevisar).toEqual({ administrativas: false, clinicas: true });
    expect(res.body.correcciones).toHaveLength(1);
    expect(res.body.correcciones[0]).toMatchObject({ tipo: "clinica", campo: "Medicación", accion: "crear", valorNuevo: "Medicación ficticia de Martín" });
  });

  it("el profesional ve las de salud de su ámbito", async () => {
    const res = await valeria.get("/api/gestion/correcciones");
    expect(res.body.correcciones.map((c) => c.persona.legajo)).toEqual([70002]); // Martín es de Obras
  });

  it("un empleado común o el administrador técnico no acceden a la bandeja", async () => {
    expect((await lucia.get("/api/gestion/correcciones")).status).toBe(403);
    expect((await tomas.get("/api/gestion/correcciones")).status).toBe(403);
  });

  it("cuenta las pendientes según el rol", async () => {
    expect((await carla.get("/api/gestion/correcciones/pendientes")).body.cantidad).toBe(1);
    expect((await paula.get("/api/gestion/correcciones/pendientes")).body.cantidad).toBe(1);
    expect((await lucia.get("/api/gestion/correcciones/pendientes")).body.cantidad).toBe(0);
  });

  it("marcar como revisada confirma el dato y el empleado lo ve como revisado", async () => {
    const { body } = await carla.get("/api/gestion/correcciones");
    const res = await carla.post(`/api/gestion/correcciones/${body.correcciones[0].id}/resolucion`).set(H).send({ decision: "revisada" });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("revisada");

    const ficha = await martin.get("/api/salud/ficha");
    expect(ficha.body.laboral.puesto).toEqual({ valor: "Capataz de cuadrilla", estado: "revisado" });
    // No se puede resolver dos veces.
    const otra = await carla.post(`/api/gestion/correcciones/${body.correcciones[0].id}/resolucion`).set(H).send({ decision: "revertir" });
    expect(otra.status).toBe(409);
  });

  it("revertir restaura el valor anterior y avisa al empleado sin datos médicos", async () => {
    const { body } = await paula.get("/api/gestion/correcciones");
    const res = await paula
      .post(`/api/gestion/correcciones/${body.correcciones[0].id}/resolucion`)
      .set(H)
      .send({ decision: "revertir", nota: "No figura en la documentación presentada" });
    expect(res.body.estado).toBe("revertida");

    const salud = await martin.get("/api/salud/ficha/salud");
    expect(salud.body.declaraciones).toHaveLength(0); // la medicación agregada se dio de baja

    const { body: recordatorios } = await martin.get("/api/salud/recordatorios");
    const aviso = recordatorios.recordatorios.find((r) => r.titulo === "Se revisó un cambio en tu ficha");
    expect(aviso.mensaje).toContain("Información de salud");
    expect(aviso.mensaje).not.toMatch(/Medicación ficticia/);
  });

  it("revertir un grupo sanguíneo corregido vuelve al confirmado", async () => {
    await lucia.put("/api/salud/ficha/salud/grupo-sanguineo").set(H).send({ grupoSanguineo: "B-" });
    const { body } = await paula.get("/api/gestion/correcciones");
    const correccion = body.correcciones.find((c) => c.campo === "Grupo sanguíneo");
    expect(correccion).toMatchObject({ valorAnterior: "0+", valorNuevo: "B-" });
    await paula.post(`/api/gestion/correcciones/${correccion.id}/resolucion`).set(H).send({ decision: "revertir" });
    const salud = await lucia.get("/api/salud/ficha/salud");
    expect(salud.body.grupoSanguineo).toEqual({ valor: "0+", estado: "revisado" });
  });

  it("Recursos Humanos no puede resolver correcciones de salud ni ids manipulados", async () => {
    await lucia.put("/api/salud/ficha/salud/cobertura").set(H).send({ cobertura: "Otra obra social ficticia" });
    const { body } = await paula.get("/api/gestion/correcciones");
    const clinica = body.correcciones.find((c) => c.campo === "Cobertura de salud");
    expect((await carla.post(`/api/gestion/correcciones/${clinica.id}/resolucion`).set(H).send({ decision: "revisada" })).status).toBe(404);
    expect((await carla.post("/api/gestion/correcciones/x-1/resolucion").set(H).send({ decision: "revisada" })).status).toBe(404);
  });

  it("el profesional no puede resolver correcciones fuera de su ámbito", async () => {
    const { body } = await paula.get("/api/gestion/correcciones");
    const deLucia = body.correcciones.find((c) => c.persona.legajo === 70001); // Hacienda
    const res = await valeria.post(`/api/gestion/correcciones/${deLucia.id}/resolucion`).set(H).send({ decision: "revisada" });
    expect(res.status).toBe(404);
  });

  it("nadie revisa correcciones de su propia ficha", async () => {
    await carla.put("/api/salud/ficha/laboral").set(H).send({ puesto: "Jefa de área" });
    const { body } = await carla.get("/api/gestion/correcciones");
    expect(body.correcciones.some((c) => c.persona.legajo === 70005)).toBe(false);
    const propia = await entorno.dbs.admin("correccion_ficha").where({ id_persona: 900005 }).first("id");
    const res = await carla.post(`/api/gestion/correcciones/a-${propia.id}/resolucion`).set(H).send({ decision: "revisada" });
    expect(res.status).toBe(403);
  });

  it("valida la decisión y exige el encabezado anti-CSRF", async () => {
    expect((await carla.post("/api/gestion/correcciones/a-1/resolucion").set(H).send({ decision: "borrar" })).status).toBe(400);
    expect((await carla.post("/api/gestion/correcciones/a-1/resolucion").send({ decision: "revisada" })).status).toBe(403);
  });
});
