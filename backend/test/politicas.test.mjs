import { describe, it, expect } from "vitest";
import { require } from "./ayudantes.mjs";

const { puede } = require("../src/politicas/politicas");

const OBRAS = 9102;
const HACIENDA = 9101;
const actor = (id_persona, ...roles) => ({
  id_persona,
  roles: [{ rol: "EMPLEADO", ambito_id_reparticion: null }, ...roles],
});
const rol = (r, ambito = null) => ({ rol: r, ambito_id_reparticion: ambito });

const lucia = actor(1); // empleada de Hacienda
const ctxLucia = { id_persona_titular: 1, id_reparticion_titular: HACIENDA };
const ctxMartin = { id_persona_titular: 2, id_reparticion_titular: OBRAS };

const profObras = actor(3, rol("PROFESIONAL_SALUD", OBRAS));
const coordinador = actor(4, rol("COORDINADOR_SALUD"));
const rrhh = actor(5, rol("RECURSOS_HUMANOS"));
const adminTecnico = actor(6, rol("ADMINISTRADOR_TECNICO"));

describe("Políticas de acceso", () => {
  it("el empleado accede solo a sus propios datos", () => {
    expect(puede(lucia, "leer", "datos_propios", ctxLucia)).toBe(true);
    expect(puede(lucia, "leer", "datos_propios", ctxMartin)).toBe(false);
    expect(puede(lucia, "leer", "datos_clinicos", ctxLucia)).toBe(true);
    expect(puede(lucia, "leer", "datos_clinicos", ctxMartin)).toBe(false);
  });

  it("el empleado declara pero no verifica sus datos clínicos", () => {
    expect(puede(lucia, "declarar", "datos_clinicos", ctxLucia)).toBe(true);
    expect(puede(lucia, "verificar", "datos_clinicos", ctxLucia)).toBe(false);
    expect(puede(lucia, "registrar", "aptitud", ctxLucia)).toBe(false);
  });

  it("el profesional accede a datos clínicos solo dentro de su ámbito", () => {
    expect(puede(profObras, "leer", "datos_clinicos", ctxMartin)).toBe(true);
    expect(puede(profObras, "verificar", "datos_clinicos", ctxMartin)).toBe(true);
    expect(puede(profObras, "registrar", "aptitud", ctxMartin)).toBe(true);
    expect(puede(profObras, "leer", "datos_clinicos", ctxLucia)).toBe(false);
    expect(puede(profObras, "registrar", "aptitud", ctxLucia)).toBe(false);
  });

  it("Recursos Humanos nunca accede a datos clínicos", () => {
    expect(puede(rrhh, "leer", "datos_clinicos", ctxMartin)).toBe(false);
    expect(puede(rrhh, "leer", "cumplimiento", ctxMartin)).toBe(true);
    expect(puede(rrhh, "gestionar", "controles", ctxMartin)).toBe(false);
  });

  it("el coordinador gestiona agenda y roles, pero no lee datos clínicos", () => {
    expect(puede(coordinador, "gestionar", "controles", ctxMartin)).toBe(true);
    expect(puede(coordinador, "gestionar", "roles")).toBe(true);
    expect(puede(coordinador, "leer", "datos_clinicos", ctxMartin)).toBe(false);
  });

  it("Capital Humano (salud) carga y revisa datos clínicos; Recursos Humanos solo lo administrativo", () => {
    const chSalud = actor(7, rol("CAPITAL_HUMANO_SALUD"));
    expect(puede(chSalud, "leer", "datos_clinicos", ctxMartin)).toBe(true);
    expect(puede(chSalud, "registrar", "datos_clinicos", ctxMartin)).toBe(true);
    expect(puede(chSalud, "revisar", "correcciones_clinicas", ctxMartin)).toBe(true);
    expect(puede(chSalud, "revisar", "correcciones_ficha", ctxMartin)).toBe(false);
    expect(puede(chSalud, "registrar", "aptitud", ctxMartin)).toBe(false);

    expect(puede(rrhh, "cargar", "datos_ficha", ctxMartin)).toBe(true);
    expect(puede(rrhh, "revisar", "correcciones_ficha", ctxMartin)).toBe(true);
    expect(puede(rrhh, "revisar", "correcciones_clinicas", ctxMartin)).toBe(false);
  });

  it("el administrador técnico no obtiene acceso clínico", () => {
    for (const accion of ["leer", "declarar", "registrar", "verificar"]) {
      expect(puede(adminTecnico, accion, "datos_clinicos", ctxMartin)).toBe(false);
    }
    expect(puede(adminTecnico, "leer", "datos_propios", ctxMartin)).toBe(false);
    expect(puede(adminTecnico, "gestionar", "roles")).toBe(true);
  });

  it("deniega por defecto acciones desconocidas y actores inválidos", () => {
    expect(puede(coordinador, "borrar", "todo")).toBe(false);
    expect(puede(null, "leer", "datos_propios", ctxLucia)).toBe(false);
    expect(puede({ id_persona: 1 }, "leer", "datos_propios", ctxLucia)).toBe(false);
  });
});
