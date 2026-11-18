import { describe, it, expect, vi } from "vitest";
import { extraerTokenIngreso } from "./tokenIngreso";

const ventanaCon = (href) => {
  const ventana = { location: { href }, history: { replaceState: vi.fn() } };
  return ventana;
};

describe("extraerTokenIngreso", () => {
  it("lee el token antes del # y lo borra de la URL", () => {
    const v = ventanaCon("https://salud.ejemplo.test/?auth=abc123#/salud");
    expect(extraerTokenIngreso(v)).toBe("abc123");
    expect(v.history.replaceState).toHaveBeenCalledWith(null, "", "https://salud.ejemplo.test/#/salud");
  });

  it("lee el token dentro del hash y conserva otros parámetros", () => {
    const v = ventanaCon("https://salud.ejemplo.test/#/salud?auth=xyz&vista=1");
    expect(extraerTokenIngreso(v)).toBe("xyz");
    expect(v.history.replaceState).toHaveBeenCalledWith(null, "", "https://salud.ejemplo.test/#/salud?vista=1");
  });

  it("no toca la URL si no hay token", () => {
    const v = ventanaCon("https://salud.ejemplo.test/#/salud");
    expect(extraerTokenIngreso(v)).toBeNull();
    expect(v.history.replaceState).not.toHaveBeenCalled();
  });
});
