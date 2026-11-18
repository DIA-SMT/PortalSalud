// Valida un CUIL/CUIT argentino: 11 dígitos y dígito verificador correcto.
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

const normalizarCuil = (valor) => String(valor ?? "").replace(/[\s.-]/g, "");

function cuilValido(valor) {
  const cuil = normalizarCuil(valor);
  if (!/^\d{11}$/.test(cuil)) return false;
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(cuil[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(cuil[10]);
}

// Completa el dígito verificador (útil para generar CUIL ficticios en pruebas).
function completarCuil(diezDigitos) {
  const base = String(diezDigitos);
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(base[i]), 0);
  const resto = 11 - (suma % 11);
  return `${base}${resto === 11 ? 0 : resto === 10 ? 9 : resto}`;
}

module.exports = { cuilValido, normalizarCuil, completarCuil };
