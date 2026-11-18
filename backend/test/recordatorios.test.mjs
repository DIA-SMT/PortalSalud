import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo, require } from "./ayudantes.mjs";

const { crearServicioRecordatorios, textoParaCanalExterno } = require("../src/servicios/recordatorios");
const { fechaISO } = require("../src/utils/fechas");

const H = { "x-portal-salud": "1" };
const dias = (n) => fechaISO(new Date(Date.now() + n * 86400000));

describe("Recordatorios", () => {
  let entorno;
  let lucia;
  let martin;
  let servicio;

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    servicio = crearServicioRecordatorios(entorno.dbs, entorno.config);
    lucia = await ingresarComo(entorno.app, 900001);
    martin = await ingresarComo(entorno.app, 900002);
  });
  afterAll(() => entorno.cerrar());

  describe("listado y lectura", () => {
    it("muestra primero los no leídos y oculta los programados a futuro", async () => {
      const res = await lucia.get("/api/salud/recordatorios");
      expect(res.status).toBe(200);
      expect(res.body.noLeidos).toBe(2);
      expect(res.body.recordatorios.map((r) => Boolean(r.leidoEn))).toEqual([false, false, true]);
      expect(JSON.stringify(res.body)).not.toContain("Recordatorio futuro");
    });

    it("confirma la lectura de forma idempotente", async () => {
      const { body } = await lucia.get("/api/salud/recordatorios");
      const id = body.recordatorios[0].id;
      const primero = await lucia.post(`/api/salud/recordatorios/${id}/leido`).set(H);
      expect(primero.status).toBe(200);
      const segundo = await lucia.post(`/api/salud/recordatorios/${id}/leido`).set(H);
      expect(segundo.body.leidoEn).toBe(primero.body.leidoEn);
      const contador = await lucia.get("/api/salud/recordatorios/no-leidos");
      expect(contador.body.cantidad).toBe(1);
    });

    it("no permite marcar recordatorios de otro empleado", async () => {
      const ajeno = await entorno.dbs.admin("recordatorio").where({ id_persona: 900002 }).first("id");
      const res = await lucia.post(`/api/salud/recordatorios/${ajeno.id}/leido`).set(H);
      expect(res.status).toBe(404);
      const fila = await entorno.dbs.admin("recordatorio").where({ id: ajeno.id }).first();
      expect(fila.leido_en).toBeNull();
    });

    it("marca todos como leídos sin tocar los de otros", async () => {
      await lucia.post("/api/salud/recordatorios/leidos").set(H);
      expect((await lucia.get("/api/salud/recordatorios/no-leidos")).body.cantidad).toBe(0);
      expect((await martin.get("/api/salud/recordatorios/no-leidos")).body.cantidad).toBe(1);
    });
  });

  describe("generación automática", () => {
    it("crea un aviso según la anticipación elegida y no lo duplica", async () => {
      // Martín: control en 2 días, sin preferencias (3 días por defecto).
      const creados = await servicio.generarAutomaticos();
      expect(creados).toBeGreaterThan(0);
      expect(await servicio.generarAutomaticos()).toBe(0);

      const { body } = await martin.get("/api/salud/recordatorios");
      const aviso = body.recordatorios.find((r) => r.tipo === "control");
      expect(aviso.titulo).toBe("Tenés un control en 2 días");
      expect(aviso.mensaje).toContain("Examen de riesgo específico");
    });

    it("respeta la anticipación: Lucía (3 días) aún no recibe el del control en 6 días", async () => {
      const filas = await entorno.dbs.admin("recordatorio").where({ id_persona: 900001 }).whereNotNull("clave_generacion");
      expect(filas).toHaveLength(0);
      await lucia.put("/api/salud/preferencias").set(H).send({ diasAnticipacion: 7 });
      await servicio.generarAutomaticos();
      const ahora = await entorno.dbs.admin("recordatorio").where({ id_persona: 900001 }).whereNotNull("clave_generacion");
      expect(ahora.length).toBeGreaterThan(0);
    });

    it("el texto para canales externos nunca incluye datos del control", () => {
      expect(textoParaCanalExterno()).not.toMatch(/examen|control de|laboratorio|diagn/i);
    });
  });

  describe("preferencias", () => {
    it("devuelve valores por defecto y los canales disponibles", async () => {
      const res = await martin.get("/api/salud/preferencias");
      expect(res.body).toMatchObject({
        configurado: false,
        diasAnticipacion: 3,
        canalApp: true,
        canalEmail: false,
        canalesDisponibles: { email: false, whatsapp: false },
      });
    });

    it("valida la anticipación", async () => {
      const res = await martin.put("/api/salud/preferencias").set(H).send({ diasAnticipacion: 30 });
      expect(res.status).toBe(400);
    });

    it("no activa canales externos mientras no existan", async () => {
      const res = await martin
        .put("/api/salud/preferencias")
        .set(H)
        .send({ diasAnticipacion: 2, canalEmail: true, consentimiento: true });
      expect(res.status).toBe(409);
    });

    it("con el canal habilitado exige consentimiento y lo registra", async () => {
      const svc = crearServicioRecordatorios(entorno.dbs, { canalesExternos: { email: true, whatsapp: false } });
      await expect(svc.guardarPreferencias(900005, { diasAnticipacion: 3, canalEmail: true })).rejects.toMatchObject({ code: 400 });
      const ok = await svc.guardarPreferencias(900005, { diasAnticipacion: 3, canalEmail: true, consentimiento: true });
      expect(ok.canalEmail).toBe(true);
      const fila = await entorno.dbs.admin("preferencia_notificacion").where({ id_persona: 900005 }).first();
      expect(fila.consentimiento_email_en).not.toBeNull();
      await svc.guardarPreferencias(900005, { diasAnticipacion: 3, canalEmail: false });
      const revocado = await entorno.dbs.admin("preferencia_notificacion").where({ id_persona: 900005 }).first();
      expect(revocado.consentimiento_email_en).toBeNull();
    });
  });

  describe("reprogramación de controles", () => {
    const controlDe = (persona, filtro) => entorno.dbs.admin("control_medico").where({ id_persona: persona, ...filtro }).first();

    it("permite pedir reprogramar un control agendado con anticipación, una sola vez", async () => {
      const control = await controlDe(900001, { tipo_control: "Evaluación ergonómica del puesto" });
      const res = await lucia
        .post(`/api/salud/controles/${control.id}/reprogramacion`)
        .set(H)
        .send({ motivo: "Ese día estoy de licencia ordinaria" });
      expect(res.status).toBe(201);
      expect(res.body.solicitudReprogramacion).toMatchObject({ estado: "pendiente" });
      expect(res.body.puedeSolicitarReprogramacion).toBe(false);

      const repetida = await lucia
        .post(`/api/salud/controles/${control.id}/reprogramacion`)
        .set(H)
        .send({ motivo: "Otro motivo cualquiera" });
      expect(repetida.status).toBe(409);
    });

    it("rechaza controles vencidos, realizados o demasiado cercanos", async () => {
      const vencido = await controlDe(900001, { tipo_control: "Control de agudeza visual" });
      const r1 = await lucia.post(`/api/salud/controles/${vencido.id}/reprogramacion`).set(H).send({ motivo: "No puedo asistir" });
      expect(r1.status).toBe(409);

      await entorno.dbs.admin("control_medico").where({ id: vencido.id }).update({ fecha_programada: dias(1) });
      const r2 = await lucia.post(`/api/salud/controles/${vencido.id}/reprogramacion`).set(H).send({ motivo: "No puedo asistir" });
      expect(r2.status).toBe(409);
      expect(r2.body.message).toMatch(/menos de 2 días/);
    });

    it("no permite pedir reprogramar controles ajenos", async () => {
      const ajeno = await controlDe(900002, {});
      const res = await lucia.post(`/api/salud/controles/${ajeno.id}/reprogramacion`).set(H).send({ motivo: "Intento ajeno" });
      expect(res.status).toBe(404);
    });

    it("valida el motivo", async () => {
      const control = await controlDe(900001, { tipo_control: "Examen periódico anual", estado: "programado" });
      const res = await lucia.post(`/api/salud/controles/${control.id}/reprogramacion`).set(H).send({ motivo: "no" });
      expect(res.status).toBe(400);
    });
  });
});
