// Lector CSV mínimo (RFC 4180): comillas, comillas dobles escapadas y saltos de
// línea dentro de campos. Detecta el separador (";" de Excel en español, o ",")
// y quita el BOM de UTF-8. Devuelve filas con su número de línea original.
const BOM = String.fromCharCode(0xfeff);

function leerCsv(texto) {
  const contenido = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const primeraLinea = contenido.split(/\r?\n/, 1)[0] || "";
  const separador = (primeraLinea.match(/;/g) || []).length >= (primeraLinea.match(/,/g) || []).length ? ";" : ",";

  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;
  let linea = 1;
  let lineaInicio = 1;

  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i];
    if (entreComillas) {
      if (c === '"' && contenido[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        if (c === "\n") linea++;
        campo += c;
      }
      continue;
    }
    if (c === '"') entreComillas = true;
    else if (c === separador) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && contenido[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push({ linea: lineaInicio, valores: fila });
      fila = [];
      campo = "";
      linea++;
      lineaInicio = linea;
    } else campo += c;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push({ linea: lineaInicio, valores: fila });
  }
  // Se descartan filas totalmente vacías.
  return { separador, filas: filas.filter((f) => f.valores.some((v) => v.trim() !== "")) };
}

module.exports = { leerCsv };
