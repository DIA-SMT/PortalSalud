// Marcas diacríticas combinantes (U+0300 a U+036F), armadas sin escapes literales.
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(DIACRITICOS, "");

// Texto limpio (espacios colapsados) o null si queda vacío.
const limpiarTexto = (valor, max) => {
  const limpio = String(valor ?? "").trim().replace(/\s+/g, " ");
  return limpio === "" ? null : limpio.slice(0, max);
};

module.exports = { sinTildes, limpiarTexto };
