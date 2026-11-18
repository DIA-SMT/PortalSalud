import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearEntornoPrueba, ingresarComo, require } from "./ayudantes.mjs";

const { leerCsv } = require("../src/utils/csv");
const { cuilValido, completarCuil } = require("../src/utils/cuil");

const H = { "x-portal-salud": "1" };
const cuil = (n) => completarCuil(`0030${String(n).padStart(6, "0")}`);
const csv = (filas, encabezado = "legajo;cuil;apellido;nombre;reparticion;id_reparticion;area;puesto;actividad") =>
  Buffer.from([encabezado, ...filas].join("\r\n"), "utf8");

describe("Utilidades", () => {
  it("lee CSV con punto y coma, comillas, BOM y saltos de línea dentro de campos", () => {
    const { separador, filas } = leerCsv('﻿a;b\r\n1;"x; y"\r\n2;"línea\nnueva ""citada"""\r\n\r\n');
    expect(separador).toBe(";");
    expect(filas.map((f) => f.valores)).toEqual([["a", "b"], ["1", "x; y"], ["2", 'línea\nnueva "citada"']]);
    expect(filas.map((f) => f.linea)).toEqual([1, 2, 3]);
  });

  it("valida el dígito verificador del CUIL", () => {
    expect(cuilValido("20-11111111-2")).toBe(true);
    expect(cuilValido("20111111113")).toBe(false);
    expect(cuilValido("123")).toBe(false);
  });
});

describe("Padrón de empleados", () => {
  let entorno;
  let carla; // RECURSOS_HUMANOS (global)
  let paula; // CAPITAL_HUMANO_SALUD
  let lucia; // empleada
  let valeria; // profesional (sin acceso al padrón)

  beforeAll(async () => {
    entorno = await crearEntornoPrueba();
    [carla, paula, lucia, valeria] = await Promise.all([900005, 900007, 900001, 900003].map((id) => ingresarComo(entorno.app, id)));
  });
  afterAll(() => entorno.cerrar());

  const importar = (agente, buffer, { confirmar = false, padronCompleto = false, nombre = "padron.csv" } = {}) =>
    agente
      .post("/api/gestion/padron/importaciones")
      .set(H)
      .field("confirmar", String(confirmar))
      .field("padronCompleto", String(padronCompleto))
      .attach("archivo", buffer, nombre);

  describe("permisos", () => {
    it("solo Recursos Humanos con alcance global importa; Capital Humano (salud) consulta", async () => {
      const archivo = csv([`80001;${cuil(1)};Alta;Uno;;;;;`]);
      expect((await importar(paula, archivo)).status).toBe(403);
      expect((await paula.get("/api/gestion/padron")).status).toBe(200);
      expect((await lucia.get("/api/gestion/padron")).status).toBe(403);
      expect((await valeria.get("/api/gestion/padron")).status).toBe(403);
      expect((await lucia.get("/api/gestion/padron/plantilla")).status).toBe(403);
    });
  });

  describe("previsualización", () => {
    it("cuenta altas, actualizaciones y errores con su línea, sin tocar la base", async () => {
      const antes = await entorno.dbs.admin("padron_empleado").count({ n: "*" }).first();
      const res = await importar(
        carla,
        csv([
          `80001;${cuil(1)};Alta;Uno;Secretaría X;;Área X;Puesto X;`,
          `70002;${completarCuil("0020070002")};Prueba;Martín Ernesto;;;;;`, // cambia el nombre
          `70003;${completarCuil("0020070003")};Demo;Valeria;;;;;`, // sin cambios
          `80002;20111111113;Cuil;Malo;;;;;`,
          `80001;${cuil(3)};Repetido;Legajo;;;;;`,
          `abc;${cuil(4)};;Sin apellido;;;;;`,
        ])
      );
      expect(res.status).toBe(200);
      expect(res.body.confirmado).toBe(false);
      expect(res.body.resumen).toMatchObject({ filas: 6, altas: 1, actualizaciones: 1, sinCambios: 1, errores: 3 });
      expect(res.body.errores.map((e) => [e.linea, e.mensaje])).toEqual([
        [5, "CUIL inválido"],
        [6, "legajo repetido (también en la línea 2)"],
        [7, "legajo inválido; falta el apellido"],
      ]);
      const despues = await entorno.dbs.admin("padron_empleado").count({ n: "*" }).first();
      expect(despues.n).toBe(antes.n);
    });

    it("explica qué columnas faltan", async () => {
      const res = await importar(carla, csv(["1;2"], "legajo;nombre"));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cuil, apellido/);
    });

    it("lee archivos exportados en ANSI (latin1) con tildes", async () => {
      const latin1 = Buffer.from(`legajo,cuil,apellido,nombre\r\n80010,${cuil(10)},Hernández,José\r\n`, "latin1");
      const res = await importar(carla, latin1, { confirmar: true });
      expect(res.status).toBe(201);
      const fila = await entorno.dbs.admin("padron_empleado").where({ legajo: 80010 }).first();
      expect(fila).toMatchObject({ apellido: "Hernández", nombre: "José" });
    });
  });

  describe("importación", () => {
    it("aplica altas y datos laborales sin pisar correcciones pendientes del empleado", async () => {
      const res = await importar(
        carla,
        csv([
          `80001;${cuil(1)};Alta;Uno;Secretaría X;9101;Área X;Puesto X;Tareas X`,
          `70002;${completarCuil("0020070002")};Prueba;Martín;;;Mantenimiento vial (ficticia);Operario;Bacheo`,
          `80002;20111111113;Cuil;Malo;;;;;`,
        ]),
        { confirmar: true }
      );
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ confirmado: true, omitidosPorCorreccion: 1 });

      // Martín tiene una corrección pendiente del puesto: no se pisa; la actividad sí se carga.
      const martin = await entorno.dbs.admin("datos_laborales").where({ id_persona: 900002 }).first();
      expect(martin).toMatchObject({ puesto: "Capataz de cuadrilla", actividad: "Bacheo" });

      // Alta sin cuenta: queda con id provisorio y los datos laborales cargados por Capital Humano.
      const alta = await entorno.dbs.admin("padron_empleado").where({ legajo: 80001 }).first();
      expect(alta.id_persona).toBeNull();
      const laborales = await entorno.dbs.admin("datos_laborales").where({ id_persona: -alta.id }).first();
      expect(laborales).toMatchObject({ area: "Área X", origen: "capital_humano", actualizado_por: 900005 });

      const historial = await carla.get("/api/gestion/padron/importaciones");
      expect(historial.body.importaciones[0]).toMatchObject({ altas: 1, errores: 1 });
    });

    it("con padrón completo, marca como inactivos a quienes no figuran", async () => {
      const res = await importar(carla, csv([`70001;${completarCuil("0020070001")};Ficticia;Lucía;;;;;`]), {
        confirmar: true,
        padronCompleto: true,
      });
      expect(res.body.resumen.bajas).toBeGreaterThan(5);
      expect((await entorno.dbs.admin("padron_empleado").where({ legajo: 70002 }).first()).activo).toBeFalsy();
      expect((await entorno.dbs.admin("padron_empleado").where({ legajo: 70001 }).first()).activo).toBeTruthy();
    });

    it("si la persona ya ingresó al portal, el alta queda vinculada en el momento", async () => {
      await entorno.dbs.admin("padron_empleado").where({ legajo: 70001 }).del();
      await importar(carla, csv([`70001;${completarCuil("0020070001")};Ficticia;Lucía;;;;;`]), { confirmar: true });
      const fila = await entorno.dbs.admin("padron_empleado").where({ legajo: 70001 }).first();
      expect(fila.id_persona).toBe(900001);
    });
  });

  describe("búsqueda", () => {
    it("busca por legajo, apellido o CUIL", async () => {
      const porLegajo = await paula.get("/api/gestion/padron?buscar=70020");
      expect(porLegajo.body.empleados.map((e) => e.apellido)).toEqual(["Pendiente"]);
      expect(porLegajo.body.empleados[0].ingresoAlPortal).toBe(false);

      const porApellido = await paula.get("/api/gestion/padron?buscar=hernan");
      expect(porApellido.body.empleados.map((e) => e.nombre)).toEqual(["José"]);

      const porCuil = await paula.get(`/api/gestion/padron?buscar=${completarCuil("0020070020").slice(2, 10)}`);
      expect(porCuil.body.empleados.map((e) => e.legajo)).toContain(70020);
    });

    it("descarga la plantilla con BOM para Excel", async () => {
      const res = await carla.get("/api/gestion/padron/plantilla");
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text).toContain("legajo;cuil;apellido;nombre");
    });
  });

  describe("vínculo al primer ingreso", () => {
    it("traslada lo cargado con id provisorio a la cuenta real", async () => {
      const rosaPadron = await entorno.dbs.admin("padron_empleado").where({ legajo: 70020 }).first();
      expect(rosaPadron.id_persona).toBeNull();

      const rosa = await ingresarComo(entorno.app, 900008);
      const ficha = await rosa.get("/api/salud/ficha");
      expect(ficha.body.laboral.puesto).toEqual({ valor: "Cajera", estado: "capital_humano" });
      const controles = await rosa.get("/api/salud/controles");
      expect(controles.body.controles.map((c) => c.tipo)).toEqual(["Examen periódico anual"]);

      const vinculada = await entorno.dbs.admin("padron_empleado").where({ legajo: 70020 }).first();
      expect(vinculada.id_persona).toBe(900008);
      expect(await entorno.dbs.admin("datos_laborales").where({ id_persona: -rosaPadron.id })).toHaveLength(0);
      expect(await entorno.dbs.admin("control_medico").where({ id_persona: -rosaPadron.id })).toHaveLength(0);
    });
  });
});
