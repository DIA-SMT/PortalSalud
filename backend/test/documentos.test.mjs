import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { crearEntornoPrueba, ingresarComo, require } from "./ayudantes.mjs";

const { crearPdfFicticio } = require("../db/seeds/pdfFicticio");

const H = { "x-portal-salud": "1" };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

// Lee la respuesta binaria completa como Buffer.
const comoBuffer = (res, callback) => {
  const partes = [];
  res.on("data", (c) => partes.push(c));
  res.on("end", () => callback(null, Buffer.concat(partes)));
};

describe("Documentos e historial", () => {
  let entorno;
  let lucia;
  let martin;

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    lucia = await ingresarComo(entorno.app, 900001);
    martin = await ingresarComo(entorno.app, 900002);
  });
  afterAll(() => entorno.cerrar());

  const subir = (agente, { archivo, nombre, tipo = "constancia", titulo = "Documento de prueba", idControl } = {}) => {
    const req = agente.post("/api/salud/documentos").set(H).field("tipo", tipo).field("titulo", titulo);
    if (idControl) req.field("idControl", String(idControl));
    return archivo ? req.attach("archivo", archivo, nombre) : req;
  };

  describe("listado", () => {
    it("lista documentos administrativos y clínicos propios, sin rutas internas", async () => {
      const res = await lucia.get("/api/salud/documentos");
      expect(res.status).toBe(200);
      expect(res.body.documentos.map((d) => [d.clasificacion, d.titulo])).toEqual(
        expect.arrayContaining([
          ["administrativo", "Constancia de asistencia (ficticia)"],
          ["clinico", "Estudio de laboratorio (ficticio)"],
        ])
      );
      expect(JSON.stringify(res.body)).not.toMatch(/ruta_almacenamiento|\.bin|sha256/);
      const propio = res.body.documentos.find((d) => d.subidoPorTitular);
      expect(propio).toMatchObject({ estadoValidacion: "pendiente", eliminable: true });
    });

    it("otro empleado no ve esos documentos", async () => {
      const res = await martin.get("/api/salud/documentos");
      expect(res.body.documentos).toEqual([]);
    });
  });

  describe("subida", () => {
    it("acepta un PDF válido, lo guarda cifrado y queda pendiente de validación", async () => {
      const pdf = crearPdfFicticio(["Certificado de prueba"]);
      const res = await subir(martin, { archivo: pdf, nombre: "certificado.pdf", tipo: "certificado", titulo: "Certificado médico ficticio" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ clasificacion: "clinico", estadoValidacion: "pendiente", mime: "application/pdf", eliminable: true });

      // En disco no queda el contenido en claro, y en la BD el título clínico está cifrado.
      const archivos = await fs.readdir(entorno.config.documentosDir);
      const contenidos = await Promise.all(archivos.map((a) => fs.readFile(path.join(entorno.config.documentosDir, a))));
      expect(contenidos.some((c) => c.includes(Buffer.from("%PDF")))).toBe(false);
      const fila = await entorno.dbs.clinica("documento_clinico").where({ id_persona: 900002 }).first();
      expect(fila.titulo_cif).not.toContain("Certificado");
    });

    it("acepta imágenes PNG y asocia el documento a un control propio", async () => {
      const control = await entorno.dbs.admin("control_medico").where({ id_persona: 900002 }).first("id");
      const res = await subir(martin, { archivo: PNG, nombre: "turno.png", idControl: control.id });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ clasificacion: "administrativo", idControl: control.id });
    });

    it("rechaza tipos no permitidos aunque cambien la extensión", async () => {
      const exe = Buffer.from("MZ\x90\x00 programa ficticio");
      const r1 = await subir(martin, { archivo: exe, nombre: "documento.pdf" });
      expect(r1.status).toBe(415);
      const r2 = await subir(martin, { archivo: PNG, nombre: "imagen.pdf" });
      expect(r2.status).toBe(415);
      expect(r2.body.message).toMatch(/extensión/);
    });

    it("rechaza PDFs con contenido activo", async () => {
      const malicioso = Buffer.from("%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF");
      const res = await subir(martin, { archivo: malicioso, nombre: "malicioso.pdf" });
      expect(res.status).toBe(415);
      const auditoria = await entorno.dbs.admin("auditoria_salud").where({ recurso: "documentos", resultado: "denegado" });
      expect(auditoria.length).toBeGreaterThan(0);
    });

    it("rechaza archivos de más de 5 MB", async () => {
      const grande = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024 + 10, 0x20)]);
      const res = await subir(martin, { archivo: grande, nombre: "grande.pdf" });
      expect(res.status).toBe(413);
    });

    it("valida los campos y exige archivo", async () => {
      expect((await subir(martin, { archivo: PNG, nombre: "a.png", tipo: "otro" })).status).toBe(400);
      expect((await subir(martin, { archivo: PNG, nombre: "a.png", titulo: "x" })).status).toBe(400);
      expect((await subir(martin, {})).status).toBe(400);
    });

    it("no permite asociar a un control de otro empleado", async () => {
      const ajeno = await entorno.dbs.admin("control_medico").where({ id_persona: 900001 }).first("id");
      const res = await subir(martin, { archivo: PNG, nombre: "a.png", idControl: ajeno.id });
      expect(res.status).toBe(404);
    });

    it("exige el encabezado anti-CSRF", async () => {
      const res = await martin.post("/api/salud/documentos").field("tipo", "constancia").field("titulo", "Sin encabezado").attach("archivo", PNG, "a.png");
      expect(res.status).toBe(403);
    });
  });

  describe("descarga", () => {
    it("devuelve el archivo original descifrado y como adjunto", async () => {
      const { body } = await lucia.get("/api/salud/documentos");
      const constancia = body.documentos.find((d) => d.titulo === "Constancia de asistencia (ficticia)");
      const res = await lucia.get(`/api/salud/documentos/${constancia.id}/descarga`).buffer(true).parse(comoBuffer);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="constancia\.pdf"/);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("no permite descargar documentos ajenos ni ids manipulados", async () => {
      const { body } = await lucia.get("/api/salud/documentos");
      for (const doc of body.documentos) {
        expect((await martin.get(`/api/salud/documentos/${doc.id}/descarga`)).status).toBe(404);
      }
      expect((await lucia.get("/api/salud/documentos/..%2F..%2Fsecreto/descarga")).status).toBe(404);
      expect((await lucia.get("/api/salud/documentos/a-abc/descarga")).status).toBe(404);
    });
  });

  describe("retiro", () => {
    it("permite retirar lo propio pendiente y borra el archivo", async () => {
      const subido = await subir(martin, { archivo: PNG, nombre: "retirar.png", titulo: "Para retirar" });
      const antes = (await fs.readdir(entorno.config.documentosDir)).length;
      const res = await martin.delete(`/api/salud/documentos/${subido.body.id}`).set(H);
      expect(res.status).toBe(204);
      expect((await fs.readdir(entorno.config.documentosDir)).length).toBe(antes - 1);
    });

    it("no permite retirar documentos validados o cargados por el servicio", async () => {
      const { body } = await lucia.get("/api/salud/documentos");
      const validado = body.documentos.find((d) => d.estadoValidacion === "validado");
      const res = await lucia.delete(`/api/salud/documentos/${validado.id}`).set(H);
      expect(res.status).toBe(409);
    });

    it("no permite retirar documentos ajenos", async () => {
      const { body } = await lucia.get("/api/salud/documentos");
      const propio = body.documentos.find((d) => d.eliminable);
      expect((await martin.delete(`/api/salud/documentos/${propio.id}`).set(H)).status).toBe(404);
    });
  });

  describe("historial", () => {
    it("arma una línea de tiempo cronológica con controles, documentos y pedidos", async () => {
      const res = await lucia.get("/api/salud/historial");
      expect(res.status).toBe(200);
      const { eventos } = res.body;
      const fechas = eventos.map((e) => e.fecha);
      expect(fechas).toEqual([...fechas].sort().reverse());
      expect(new Set(eventos.map((e) => e.categoria))).toEqual(new Set(["control", "documento"]));
      expect(eventos.some((e) => e.titulo === "Control realizado" && e.responsable)).toBe(true);
      expect(eventos.some((e) => e.futuro)).toBe(true);
      // Sin controles sin fecha ni datos de otra persona.
      expect(JSON.stringify(eventos)).not.toMatch(/Actualización de vacunación|Examen de riesgo específico/);
    });
  });
});
