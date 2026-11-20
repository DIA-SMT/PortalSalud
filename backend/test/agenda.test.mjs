import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo, require } from "./ayudantes.mjs";

const { fechaISO } = require("../src/utils/fechas");

const H = { "x-portal-salud": "1" };
const dias = (n) => fechaISO(new Date(Date.now() + n * 86400000));

describe("Agenda de controles (salud laboral)", () => {
  let entorno;
  let diego; // COORDINADOR_SALUD (todas las reparticiones)
  let valeria; // PROFESIONAL_SALUD (ámbito Obras Públicas)
  let carla; // RECURSOS_HUMANOS
  let lucia; // empleada de Hacienda
  let martin; // empleado de Obras con un pedido de reprogramación

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    [diego, valeria, carla, lucia, martin] = await Promise.all(
      [900004, 900003, 900005, 900001, 900002].map((id) => ingresarComo(entorno.app, id))
    );
  });
  afterAll(() => entorno.cerrar());

  const controlDe = (persona, tipo) => entorno.dbs.admin("control_medico").where({ id_persona: persona, tipo_control: tipo }).first();
  const avisosDe = async (agente) => (await agente.get("/api/salud/recordatorios")).body.recordatorios;

  describe("permisos y ámbito", () => {
    it("el coordinador ve la agenda de todas las reparticiones", async () => {
      const res = await diego.get("/api/gestion/agenda");
      expect(res.status).toBe(200);
      const legajos = new Set(res.body.controles.map((c) => c.empleado.legajo));
      expect([...legajos]).toEqual(expect.arrayContaining([70001, 70002, 70020]));
      expect(res.body.tiposSugeridos.length).toBeGreaterThan(3);
    });

    it("la profesional solo ve su ámbito (Obras Públicas)", async () => {
      const res = await valeria.get("/api/gestion/agenda");
      expect(new Set(res.body.controles.map((c) => c.empleado.legajo))).toEqual(new Set([70002]));
    });

    it("Recursos Humanos y los empleados no acceden", async () => {
      expect((await carla.get("/api/gestion/agenda")).status).toBe(403);
      expect((await lucia.get("/api/gestion/agenda")).status).toBe(403);
      expect((await lucia.get("/api/gestion/agenda/pedidos")).status).toBe(403);
    });

    it("no expone datos clínicos ni de la ficha", async () => {
      const { body } = await diego.get("/api/gestion/agenda");
      expect(JSON.stringify(body)).not.toMatch(/Alergia|Obra social|cuil|id_persona/i);
    });

    it("filtra por estado y por texto", async () => {
      const vencidos = await diego.get("/api/gestion/agenda?estado=vencido");
      expect(vencidos.body.controles.every((c) => c.estado === "vencido")).toBe(true);
      const porNombre = await diego.get("/api/gestion/agenda?buscar=prueba");
      expect(new Set(porNombre.body.controles.map((c) => c.empleado.legajo))).toEqual(new Set([70002]));
    });
  });

  describe("alta de controles", () => {
    it("busca empleados del padrón dentro del ámbito", async () => {
      const res = await valeria.get("/api/gestion/agenda/empleados?buscar=nuevo");
      expect(res.body.empleados.map((e) => e.legajo)).toEqual([70021]); // Ezequiel, Obras
      const fuera = await valeria.get("/api/gestion/agenda/empleados?buscar=ficticia");
      expect(fuera.body.empleados).toEqual([]); // Lucía es de Hacienda
    });

    it("programa un control y avisa al empleado sin datos clínicos", async () => {
      const res = await diego
        .post("/api/gestion/agenda")
        .set(H)
        .send({ legajo: 70001, tipo: "Control de laboratorio", fechaProgramada: dias(10), lugar: "Laboratorio ficticio" });
      expect(res.status).toBe(201);
      const fila = await entorno.dbs.admin("control_medico").where({ id: res.body.id }).first();
      expect(fila).toMatchObject({ id_persona: 900001, estado: "programado", creado_por: 900004 });

      const aviso = (await avisosDe(lucia)).find((r) => r.titulo === "Tenés un nuevo control programado");
      expect(aviso.idControl).toBe(res.body.id);
      expect(aviso.mensaje).toContain("Laboratorio ficticio");
    });

    it("sin fecha queda pendiente; también para quien todavía no ingresó (id provisorio)", async () => {
      const res = await valeria.post("/api/gestion/agenda").set(H).send({ legajo: 70021, tipo: "Examen preocupacional" });
      expect(res.status).toBe(201);
      const ezequiel = await entorno.dbs.admin("padron_empleado").where({ legajo: 70021 }).first();
      const fila = await entorno.dbs.admin("control_medico").where({ id: res.body.id }).first();
      expect(fila).toMatchObject({ id_persona: -ezequiel.id, estado: "pendiente", fecha_programada: null });
    });

    it("la profesional no puede programar fuera de su ámbito", async () => {
      const res = await valeria.post("/api/gestion/agenda").set(H).send({ legajo: 70001, tipo: "Audiometría", fechaProgramada: dias(5) });
      expect(res.status).toBe(403);
    });

    it("valida legajo, tipo y fechas", async () => {
      expect((await diego.post("/api/gestion/agenda").set(H).send({ legajo: 99999, tipo: "Audiometría" })).status).toBe(404);
      expect((await diego.post("/api/gestion/agenda").set(H).send({ legajo: 70001, tipo: "x" })).status).toBe(400);
      expect((await diego.post("/api/gestion/agenda").set(H).send({ legajo: 70001, tipo: "Audiometría", fechaProgramada: "2026-13-45" })).status).toBe(400);
      expect((await diego.post("/api/gestion/agenda").set(H).send({ legajo: 70001, tipo: "Audiometría", fechaProgramada: dias(-3) })).status).toBe(400);
    });
  });

  describe("reprogramar, realizar y cancelar", () => {
    it("reprogramar un control agendado lo marca como reprogramado y avisa", async () => {
      const c = await controlDe(900001, "Examen periódico anual");
      const res = await diego.post(`/api/gestion/agenda/${c.id}/reprogramacion`).set(H).send({ fechaProgramada: dias(12) });
      expect(res.status).toBe(200);
      expect(await controlDe(900001, "Examen periódico anual")).toMatchObject({ estado: "reprogramado", fecha_programada: dias(12) });
      expect((await avisosDe(lucia)).some((r) => r.titulo === "Cambió la fecha de tu control")).toBe(true);
    });

    it("registrar como realizado guarda la fecha y la próxima revisión", async () => {
      const c = await controlDe(900001, "Control de agudeza visual"); // vencido
      const malo = await diego.post(`/api/gestion/agenda/${c.id}/realizado`).set(H).send({ fechaRealizacion: dias(1) });
      expect(malo.status).toBe(400);
      const res = await diego
        .post(`/api/gestion/agenda/${c.id}/realizado`)
        .set(H)
        .send({ fechaRealizacion: dias(0), proximaRevision: dias(365) });
      expect(res.status).toBe(200);
      expect(await controlDe(900001, "Control de agudeza visual")).toMatchObject({ estado: "realizado", proxima_revision: dias(365) });
      expect((await diego.post(`/api/gestion/agenda/${c.id}/realizado`).set(H).send({ fechaRealizacion: dias(0) })).status).toBe(409);
    });

    it("cancelar cierra el control y no permite reprogramarlo", async () => {
      const c = await controlDe(900001, "Evaluación ergonómica del puesto");
      expect((await diego.post(`/api/gestion/agenda/${c.id}/cancelacion`).set(H)).status).toBe(200);
      expect((await diego.post(`/api/gestion/agenda/${c.id}/reprogramacion`).set(H).send({ fechaProgramada: dias(30) })).status).toBe(409);
    });

    it("la profesional no puede tocar controles fuera de su ámbito", async () => {
      const c = await controlDe(900001, "Control de laboratorio");
      expect((await valeria.post(`/api/gestion/agenda/${c.id}/cancelacion`).set(H)).status).toBe(404);
    });
  });

  describe("pedidos de reprogramación", () => {
    it("lista el pedido de Martín con su motivo y el control", async () => {
      const res = await valeria.get("/api/gestion/agenda/pedidos");
      expect(res.body.pedidos).toHaveLength(1);
      expect(res.body.pedidos[0]).toMatchObject({
        motivo: "Ese día tengo licencia por vacaciones (ficticio)",
        control: { tipo: "Audiometría" },
        empleado: { legajo: 70002 },
      });
      expect((await valeria.get("/api/gestion/agenda/pedidos/pendientes")).body.cantidad).toBe(1);
    });

    it("aceptar exige nueva fecha, cambia el control y avisa al empleado", async () => {
      const { body } = await valeria.get("/api/gestion/agenda/pedidos");
      const id = body.pedidos[0].id;
      expect((await valeria.post(`/api/gestion/agenda/pedidos/${id}/resolucion`).set(H).send({ decision: "aceptada" })).status).toBe(400);

      const res = await valeria.post(`/api/gestion/agenda/pedidos/${id}/resolucion`).set(H).send({ decision: "aceptada", nuevaFecha: dias(40) });
      expect(res.status).toBe(200);
      expect(await controlDe(900002, "Audiometría")).toMatchObject({ estado: "reprogramado", fecha_programada: dias(40) });

      const controles = (await martin.get("/api/salud/controles")).body.controles;
      expect(controles.find((c) => c.tipo === "Audiometría").solicitudReprogramacion.estado).toBe("aceptada");
      expect((await avisosDe(martin)).some((r) => r.titulo === "Aceptaron tu pedido de cambio de fecha")).toBe(true);

      expect((await valeria.post(`/api/gestion/agenda/pedidos/${id}/resolucion`).set(H).send({ decision: "rechazada" })).status).toBe(409);
    });

    it("rechazar mantiene la fecha y avisa con la nota", async () => {
      // El que se programó en el alta (Lucía también tiene uno de laboratorio ya realizado).
      const c = await entorno.dbs.admin("control_medico").where({ id_persona: 900001, tipo_control: "Control de laboratorio", estado: "programado" }).first();
      await lucia.post(`/api/salud/controles/${c.id}/reprogramacion`).set(H).send({ motivo: "Tengo capacitación ese día" });
      const { body } = await diego.get("/api/gestion/agenda/pedidos");
      const pedido = body.pedidos.find((p) => p.control.id === c.id);
      const res = await diego
        .post(`/api/gestion/agenda/pedidos/${pedido.id}/resolucion`)
        .set(H)
        .send({ decision: "rechazada", nota: "Es el único turno disponible del laboratorio." });
      expect(res.status).toBe(200);
      expect((await entorno.dbs.admin("control_medico").where({ id: c.id }).first()).fecha_programada).toBe(c.fecha_programada);
      const aviso = (await avisosDe(lucia)).find((r) => r.titulo === "No se pudo cambiar la fecha de tu control");
      expect(aviso.mensaje).toContain("único turno");
    });

    it("la profesional no ve ni resuelve pedidos fuera de su ámbito", async () => {
      const c = await controlDe(900001, "Control de laboratorio");
      await entorno.dbs.admin("solicitud_reprogramacion").insert({
        id_control: c.id, id_persona: 900001, motivo: "Pedido de Hacienda", estado: "pendiente", creado_en: new Date(),
      });
      const pedido = await entorno.dbs.admin("solicitud_reprogramacion").where({ motivo: "Pedido de Hacienda" }).first();
      expect((await valeria.get("/api/gestion/agenda/pedidos")).body.pedidos.some((p) => p.id === pedido.id)).toBe(false);
      const res = await valeria.post(`/api/gestion/agenda/pedidos/${pedido.id}/resolucion`).set(H).send({ decision: "rechazada" });
      expect(res.status).toBe(404);
    });
  });

  it("todo queda auditado", async () => {
    const filas = await entorno.dbs.admin("auditoria_salud").where({ recurso: "agenda_controles" });
    expect(new Set(filas.map((f) => f.accion))).toEqual(
      new Set(["crear", "reprogramar", "registrar_realizado", "cancelar", "pedido_aceptada", "pedido_rechazada"])
    );
  });
});
