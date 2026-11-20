import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo } from "./ayudantes.mjs";

describe("Mis controles", () => {
  let entorno;
  let lucia;
  let martin;

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    lucia = await ingresarComo(entorno.app, 900001);
    martin = await ingresarComo(entorno.app, 900002);
  });
  afterAll(() => entorno.cerrar());

  it("lista los controles propios con todos los estados y orden cronológico", async () => {
    const res = await lucia.get("/api/salud/controles");
    expect(res.status).toBe(200);
    const { controles } = res.body;
    expect(controles).toHaveLength(7);
    expect(new Set(controles.map((c) => c.estado))).toEqual(
      new Set(["programado", "pendiente", "realizado", "reprogramado", "vencido", "cancelado"])
    );
    const fechas = controles.filter((c) => c.fechaProgramada).map((c) => c.fechaProgramada);
    expect(fechas).toEqual([...fechas].sort());
    // Sin fecha asignada, al final.
    expect(controles.at(-1).fechaProgramada).toBeNull();
  });

  it("incluye próxima revisión y documentos administrativos asociados", async () => {
    const { body } = await lucia.get("/api/salud/controles");
    const anterior = body.controles.find((c) => c.estado === "realizado" && c.proximaRevision);
    expect(anterior.documentos).toEqual([
      expect.objectContaining({ titulo: "Constancia de asistencia (ficticia)", estadoValidacion: "validado" }),
    ]);
  });

  it("devuelve el detalle de un control propio", async () => {
    const { body } = await lucia.get("/api/salud/controles");
    const res = await lucia.get(`/api/salud/controles/${body.controles[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: body.controles[0].id, tipo: body.controles[0].tipo });
  });

  it("no devuelve controles de otro empleado (acceso horizontal)", async () => {
    const ajeno = await entorno.dbs.admin("control_medico").where({ id_persona: 900002 }).first("id");
    const res = await lucia.get(`/api/salud/controles/${ajeno.id}`);
    expect(res.status).toBe(404);

    const { body } = await martin.get("/api/salud/controles");
    expect(body.controles.map((c) => c.tipo)).toEqual(["Examen de riesgo específico", "Audiometría"]);
  });

  it("valida el identificador", async () => {
    const res = await lucia.get("/api/salud/controles/abc");
    expect(res.status).toBe(400);
  });

  it("no expone campos internos", async () => {
    const { body } = await lucia.get("/api/salud/controles");
    expect(JSON.stringify(body)).not.toMatch(/id_persona|creado_por|ruta_almacenamiento/);
  });
});
