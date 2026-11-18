import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo } from "./ayudantes.mjs";

const H = { "x-portal-salud": "1" };

describe("Ficha de salud (vista del empleado)", () => {
  let entorno;
  let lucia;
  let martin;

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    lucia = await ingresarComo(entorno.app, 900001);
    martin = await ingresarComo(entorno.app, 900002);
  });
  afterAll(() => entorno.cerrar());

  const correccionesDe = (persona, tabla = "correccion_ficha") =>
    (tabla === "correccion_ficha" ? entorno.dbs.admin : entorno.dbs.clinica)(tabla).where({ id_persona: persona });

  describe("datos personales, contacto y laborales", () => {
    it("devuelve los datos con su estado y sin documento ni email de CiDiTuc", async () => {
      const res = await lucia.get("/api/salud/ficha");
      expect(res.status).toBe(200);
      expect(res.body.personales).toEqual({ nombre: "Lucía", apellido: "Ficticia" });
      expect(res.body.laboral).toMatchObject({
        legajo: 70001,
        reparticion: "Secretaría de Hacienda (ficticia)",
        puesto: { valor: "Analista administrativa", estado: "capital_humano" },
      });
      expect(res.body.contacto.telefonoAlternativo).toEqual({ valor: null, estado: "sin_datos" });
      expect(res.body.laboral.riesgos).toHaveLength(1);
      expect(JSON.stringify(res.body)).not.toMatch(/documento|email_persona/);
    });

    it("la corrección del empleado se aplica ya y queda pendiente de revisión", async () => {
      const res = await lucia.put("/api/salud/ficha/laboral").set(H).send({ puesto: "Analista contable" });
      expect(res.status).toBe(200);
      expect(res.body.puesto).toEqual({ valor: "Analista contable", estado: "pendiente_revision" });
      expect(res.body.area.estado).toBe("capital_humano"); // los demás campos no cambian

      const [c] = await correccionesDe(900001).where({ campo: "puesto" });
      expect(c).toMatchObject({ valor_anterior: "Analista administrativa", valor_nuevo: "Analista contable", estado: "pendiente", persona_legajo: 70001 });
    });

    it("una segunda corrección actualiza la misma entrada, y volver al original la elimina", async () => {
      await lucia.put("/api/salud/ficha/laboral").set(H).send({ puesto: "Analista de costos" });
      let filas = await correccionesDe(900001).where({ campo: "puesto" });
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({ valor_anterior: "Analista administrativa", valor_nuevo: "Analista de costos" });

      const res = await lucia.put("/api/salud/ficha/laboral").set(H).send({ puesto: "Analista administrativa" });
      expect(res.body.puesto.estado).toBe("capital_humano");
      filas = await correccionesDe(900001).where({ campo: "puesto" });
      expect(filas).toHaveLength(0);
    });

    it("guarda los medios de contacto con validación y los manda a revisión", async () => {
      const malo = await lucia.put("/api/salud/ficha/contacto").set(H).send({ emailAlternativo: "no-es-mail" });
      expect(malo.status).toBe(400);

      const ok = await lucia
        .put("/api/salud/ficha/contacto")
        .set(H)
        .send({ telefonoAlternativo: "0381 555-0000", emailAlternativo: "lucia.alt@ejemplo.test" });
      expect(ok.status).toBe(200);
      expect(ok.body.telefonoAlternativo).toEqual({ valor: "0381 555-0000", estado: "pendiente_revision" });
      expect(await correccionesDe(900001).where({ seccion: "contacto" })).toHaveLength(2);
      const resumen = await lucia.get("/api/salud/mi-resumen");
      expect(resumen.body.completitud.porcentaje).toBe(100);
    });

    it("permite el ABM de contactos de emergencia propios, sin revisión", async () => {
      const creado = await lucia
        .post("/api/salud/ficha/contactos-emergencia")
        .set(H)
        .send({ nombre: "Contacto Ficticio Dos", vinculo: "Amigo", telefono: "0381-000-0002" });
      expect(creado.status).toBe(201);
      expect(creado.body).toMatchObject({ nombre: "Contacto Ficticio Dos", prioridad: 2 });

      const editado = await lucia
        .put(`/api/salud/ficha/contactos-emergencia/${creado.body.id}`)
        .set(H)
        .send({ nombre: "Contacto Ficticio Dos", vinculo: "Pareja", telefono: "0381-000-0003" });
      expect(editado.body.vinculo).toBe("Pareja");
      expect((await lucia.delete(`/api/salud/ficha/contactos-emergencia/${creado.body.id}`).set(H)).status).toBe(204);
    });

    it("valida y limita los contactos de emergencia", async () => {
      const malo = await lucia.post("/api/salud/ficha/contactos-emergencia").set(H).send({ nombre: "X", vinculo: "Amigo", telefono: "abc" });
      expect(malo.status).toBe(400);
      const agente = await ingresarComo(entorno.app, 900006);
      for (let i = 0; i < 5; i++) {
        const r = await agente.post("/api/salud/ficha/contactos-emergencia").set(H).send({ nombre: `Contacto ${i}`, vinculo: "Amigo", telefono: "0381-000-0000" });
        expect(r.status).toBe(201);
      }
      const sexto = await agente.post("/api/salud/ficha/contactos-emergencia").set(H).send({ nombre: "Contacto 6", vinculo: "Amigo", telefono: "0381-000-0000" });
      expect(sexto.status).toBe(409);
    });

    it("no permite tocar contactos de otro empleado (acceso horizontal)", async () => {
      const { id } = await entorno.dbs.admin("contacto_emergencia").where({ id_persona: 900001 }).first("id");
      const editar = await martin.put(`/api/salud/ficha/contactos-emergencia/${id}`).set(H).send({ nombre: "Intruso", vinculo: "Nadie", telefono: "0381-999-9999" });
      expect(editar.status).toBe(404);
      expect((await martin.delete(`/api/salud/ficha/contactos-emergencia/${id}`).set(H)).status).toBe(404);
      const fila = await entorno.dbs.admin("contacto_emergencia").where({ id }).first();
      expect(fila.nombre).toBe("Contacto Ficticio Uno");
    });
  });

  describe("información de salud", () => {
    it("muestra lo cargado por Capital Humano y por el servicio de salud, con su estado", async () => {
      const res = await lucia.get("/api/salud/ficha/salud");
      expect(res.status).toBe(200);
      expect(res.body.grupoSanguineo).toEqual({ valor: "0+", estado: "capital_humano" });
      expect(res.body.cobertura).toEqual({ valor: "Obra social ficticia", estado: "capital_humano" });
      expect(res.body.declaraciones.map((d) => d.estado).sort()).toEqual(["capital_humano", "servicio_salud"]);
      expect(JSON.stringify(res.body)).not.toContain("Medicación ficticia de Martín");
    });

    it("oculta un grupo sanguíneo no confirmado", async () => {
      await entorno.dbs.clinica("ficha_salud").where({ id_persona: 900001 }).update({ grupo_sanguineo_confirmado: false });
      const res = await lucia.get("/api/salud/ficha/salud");
      expect(res.body.grupoSanguineo.valor).toBeNull();
      await entorno.dbs.clinica("ficha_salud").where({ id_persona: 900001 }).update({ grupo_sanguineo_confirmado: true });
    });

    it("el empleado corrige el grupo sanguíneo: se ve como pendiente y queda cifrado", async () => {
      const malo = await lucia.put("/api/salud/ficha/salud/grupo-sanguineo").set(H).send({ grupoSanguineo: "Z" });
      expect(malo.status).toBe(400);
      const res = await lucia.put("/api/salud/ficha/salud/grupo-sanguineo").set(H).send({ grupoSanguineo: "A+" });
      expect(res.body).toEqual({ valor: "A+", estado: "pendiente_revision" });
      const [c] = await correccionesDe(900001, "correccion_clinica").where({ campo: "grupo_sanguineo" });
      expect(c.estado).toBe("pendiente");
      expect(c.valor_nuevo_cif).not.toContain("A+");
      expect(entorno.cifrador.descifrar(c.valor_anterior_cif)).toBe("0+");
    });

    it("puede corregir datos cargados por Capital Humano y queda registro para revisar", async () => {
      const { body } = await lucia.get("/api/salud/ficha/salud");
      const alergia = body.declaraciones.find((d) => d.categoria === "alergia");
      const res = await lucia.put(`/api/salud/ficha/salud/declaraciones/${alergia.id}`).set(H).send({ descripcion: "Alergia ficticia corregida" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ descripcion: "Alergia ficticia corregida", estado: "pendiente_revision", origen: "capital_humano" });

      const fila = await entorno.dbs.clinica("declaracion_salud").where({ id: alergia.id }).first();
      expect(fila.descripcion_cif).not.toContain("corregida");
      const auditoria = await entorno.dbs.admin("auditoria_salud").where({ recurso: "datos_clinicos" });
      expect(JSON.stringify(auditoria)).not.toMatch(/corregida|Obra social|Alergia/);
    });

    it("agregar y quitar antes de la revisión no deja nada pendiente", async () => {
      const creada = await lucia.post("/api/salud/ficha/salud/declaraciones").set(H).send({ categoria: "medicacion", descripcion: "Medicamento ficticio XYZ" });
      expect(creada.status).toBe(201);
      expect(creada.body).toMatchObject({ origen: "empleado", estado: "pendiente_revision" });
      expect(await correccionesDe(900001, "correccion_clinica").where({ id_declaracion: creada.body.id })).toHaveLength(1);

      expect((await lucia.delete(`/api/salud/ficha/salud/declaraciones/${creada.body.id}`).set(H)).status).toBe(204);
      expect(await correccionesDe(900001, "correccion_clinica").where({ id_declaracion: creada.body.id })).toHaveLength(0);
    });

    it("dar de baja un dato cargado por el área queda para revisar y se conserva", async () => {
      const { body } = await lucia.get("/api/salud/ficha/salud");
      const condicion = body.declaraciones.find((d) => d.categoria === "condicion");
      expect((await lucia.delete(`/api/salud/ficha/salud/declaraciones/${condicion.id}`).set(H)).status).toBe(204);
      const [c] = await correccionesDe(900001, "correccion_clinica").where({ id_declaracion: condicion.id });
      expect(c.accion).toBe("baja");
      const fila = await entorno.dbs.clinica("declaracion_salud").where({ id: condicion.id }).first();
      expect(Boolean(fila.vigente)).toBe(false);
    });

    it("no permite modificar declaraciones de otro empleado", async () => {
      const ajena = await entorno.dbs.clinica("declaracion_salud").where({ id_persona: 900002 }).first("id");
      const res = await lucia.put(`/api/salud/ficha/salud/declaraciones/${ajena.id}`).set(H).send({ descripcion: "Intruso" });
      expect(res.status).toBe(404);
    });

    it("rechaza categorías inválidas", async () => {
      const res = await lucia.post("/api/salud/ficha/salud/declaraciones").set(H).send({ categoria: "diagnostico", descripcion: "algo" });
      expect(res.status).toBe(400);
    });

    it("actualiza la cobertura de salud", async () => {
      const res = await martin.put("/api/salud/ficha/salud/cobertura").set(H).send({ cobertura: "Prepaga ficticia" });
      expect(res.body).toEqual({ valor: "Prepaga ficticia", estado: "pendiente_revision" });
    });
  });
});
