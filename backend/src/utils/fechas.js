const ZONA = "America/Argentina/Buenos_Aires";

// Fecha calendario (YYYY-MM-DD) en la zona horaria de Tucumán.
const fechaISO = (fecha = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(fecha);

// SQLite devuelve timestamps como número (ms) y MySQL como Date: se normaliza.
const aFecha = (valor) => (valor === null || valor === undefined ? null : new Date(valor));

const aISO = (valor) => {
  const fecha = aFecha(valor);
  return fecha ? fecha.toISOString() : null;
};

module.exports = { ZONA, fechaISO, aFecha, aISO };
