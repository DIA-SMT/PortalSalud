import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo, require } from "./ayudantes.mjs";

const { mapearEmpleadoCidituc } = require("../src/servicios/fuentesEmpleados/cidituc");
const { mapearLegajoMunicipal } = require("../src/servicios/fuentesEmpleados/portalEmpleado");
const { validarRegistro } = require("../src/servicios/fuentesEmpleados/registro");
const { completarCuil } = require("../src/utils/cuil");

const H = { "x-portal-salud": "1" };
const cuilDe = (legajo) => completarCuil(`0020${String(legajo).padStart(6, "0")}`);

describe("Adaptadores de fuentes", () => {
  it("mapea los nombres de columna de CiDiTuc al registro normalizado", () => {
    const { registro } = validarRegistro(
      mapearEmpleadoCidituc({
        afiliado: 70001,
        documento_persona: cuilDe(70001),
        apellido_persona: "Ficticia",
        nombre_persona: "Lucía",
        id_reparticion: 9101,
        nombre_reparticion: "Hacienda (ficticia)",
      })
    );
    expect(registro).toMatchObject({ legajo: 70001, apellido: "Ficticia", id_reparticion: 9101, laborales: {} });
  });

  it("mapea los códigos del legajo municipal (Portal del Empleado)", () => {
    const { registro } = validarRegistro(
      mapearLegajoMunicipal({ lega_12: "70002", cuil: cuilDe(70002), apellido: "Prueba", nombre: "Martín", desc_cargo: "Chofer", area: "Vial" })
    );
    expect(registro).toMatchObject({ legajo: 70002, reparticion: null, laborales: { puesto: "Chofer", area: "Vial" } });
  });
});

describe("Sincronización del padrón desde fuentes remotas", () => {
  describe("sin integración configurada", () => {
    let entorno;
    let carla;
    beforeAll(async () => {
      entorno = await crearEntornoPrueba();
      carla = await ingresarComo(entorno.app, 900005);
    });
    afterAll(() => entorno.cerrar());

    it("lista las fuentes y marca las remotas como no disponibles", async () => {
      const res = await carla.get("/api/gestion/padron/fuentes");
      expect(res.body.fuentes.map((f) => [f.id, f.disponible])).toEqual([
        ["csv", true],
        ["portal_empleado", false],
        ["cidituc", false],
      ]);
    });

    it("responde 501 al intentar sincronizar", async () => {
      const res = await carla.post("/api/gestion/padron/sincronizaciones").set(H).send({ fuente: "portal_empleado" });
      expect(res.status).toBe(501);
      expect(res.body.message).toMatch(/todavía no está habilitada/);
    });
  });

  describe("con el Portal del Empleado configurado", () => {
    let entorno;
    let carla;
    let paula;
    let respuesta;
    const llamadas = [];

    const fetchFalso = async (url, opciones) => {
      llamadas.push({ url, opciones });
      if (respuesta instanceof Error) throw respuesta;
      return { ok: respuesta.status < 400, status: respuesta.status, json: async () => respuesta.cuerpo };
    };

    beforeAll(async () => {
      entorno = await crearEntornoPrueba({
        env: { FUENTE_PORTAL_EMPLEADO_URL: "https://legajos.ejemplo.test/padron", FUENTE_PORTAL_EMPLEADO_TOKEN: "token-servicio-ficticio" },
        fetchImpl: fetchFalso,
      });
      [carla, paula] = await Promise.all([900005, 900007].map((id) => ingresarComo(entorno.app, id)));
    });
    afterAll(() => entorno.cerrar());

    const sincronizar = (agente, confirmar) =>
      agente.post("/api/gestion/padron/sincronizaciones").set(H).send({ fuente: "portal_empleado", confirmar });

    it("previsualiza, valida los registros y autentica con el token de servicio", async () => {
      respuesta = {
        status: 200,
        cuerpo: {
          data: [
            { lega_12: 70001, cuil: cuilDe(70001), apellido: "Ficticia", nombre: "Lucía", area: "Presupuesto", desc_cargo: "Analista sr." },
            { lega_12: 90001, cuil: cuilDe(90001), apellido: "Nueva", nombre: "Persona", desc_cargo: "Administrativa" },
            { lega_12: 90002, cuil: "123", apellido: "Mal", nombre: "Cuil" },
          ],
        },
      };
      const res = await sincronizar(carla, false);
      expect(res.status).toBe(200);
      expect(res.body.resumen).toMatchObject({ filas: 3, altas: 1, errores: 1 });
      expect(res.body.errores).toEqual([{ linea: 3, legajo: 90002, mensaje: "CUIL inválido" }]);
      expect(llamadas.at(-1).url).toBe("https://legajos.ejemplo.test/padron");
      expect(llamadas.at(-1).opciones.headers["X-Token-Servicio"]).toBe("token-servicio-ficticio");
    });

    it("al confirmar marca los datos con el origen de la fuente", async () => {
      const res = await sincronizar(carla, true);
      expect(res.status).toBe(201);

      const lucia = await ingresarComo(entorno.app, 900001);
      const ficha = await lucia.get("/api/salud/ficha");
      expect(ficha.body.laboral.puesto).toEqual({ valor: "Analista sr.", estado: "portal_empleado" });

      const historial = await carla.get("/api/gestion/padron/importaciones");
      expect(historial.body.importaciones[0]).toMatchObject({ fuente: "portal_empleado", altas: 1 });
    });

    it("una corrección del empleado sobre un dato de la fuente va a la bandeja", async () => {
      const lucia = await ingresarComo(entorno.app, 900001);
      const res = await lucia.put("/api/salud/ficha/laboral").set(H).send({ puesto: "Analista semisenior" });
      expect(res.body.puesto.estado).toBe("pendiente_revision");
      const bandeja = await carla.get("/api/gestion/correcciones");
      expect(bandeja.body.correcciones.some((c) => c.valorAnterior === "Analista sr.")).toBe(true);
    });

    it("traduce los errores de la fuente", async () => {
      respuesta = { status: 500, cuerpo: {} };
      expect((await sincronizar(carla, false)).status).toBe(502);
      respuesta = { status: 200, cuerpo: { otra: "cosa" } };
      expect((await sincronizar(carla, false)).status).toBe(502);
      respuesta = new Error("ECONNREFUSED");
      expect((await sincronizar(carla, false)).status).toBe(503);
    });

    it("solo Recursos Humanos con alcance global sincroniza", async () => {
      expect((await sincronizar(paula, false)).status).toBe(403);
    });

    it("rechaza fuentes desconocidas", async () => {
      const res = await carla.post("/api/gestion/padron/sincronizaciones").set(H).send({ fuente: "otra" });
      expect(res.status).toBe(400);
    });
  });
});
