// Mismas reglas que valida el backend (express-validator), para avisar antes de enviar.
export const TELEFONO = /^[0-9+()\-\s]{6,30}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validarTelefono = (valor, { requerido = false } = {}) => {
  const v = (valor || "").trim();
  if (!v) return requerido ? "Ingresá un teléfono" : "";
  return TELEFONO.test(v) ? "" : "Usá solo números, espacios, +, - o paréntesis (6 a 30 caracteres)";
};

export const validarEmail = (valor) => {
  const v = (valor || "").trim();
  if (!v) return "";
  return EMAIL.test(v) && v.length <= 120 ? "" : "Ingresá un correo válido";
};

export const validarTexto = (valor, { min = 2, max, etiqueta }) => {
  const v = (valor || "").trim();
  if (v.length < min) return `${etiqueta}: escribí al menos ${min} caracteres`;
  if (max && v.length > max) return `${etiqueta}: hasta ${max} caracteres`;
  return "";
};
