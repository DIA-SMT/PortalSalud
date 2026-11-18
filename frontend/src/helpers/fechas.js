const FORMATO_FECHA = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

// "2026-11-24" -> fecha local (sin corrimiento por zona horaria).
export const desdeISO = (fechaIso) => {
  if (!fechaIso) return null;
  const [anio, mes, dia] = fechaIso.slice(0, 10).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
};

export const formatearFecha = (fechaIso) => {
  const fecha = desdeISO(fechaIso);
  return fecha ? FORMATO_FECHA.format(fecha) : "Sin fecha asignada";
};

// Días entre hoy y la fecha (0 = hoy, negativo = ya pasó).
export const diasHasta = (fechaIso, hoy = new Date()) => {
  const fecha = desdeISO(fechaIso);
  if (!fecha) return null;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((fecha - base) / 86400000);
};

export const textoDiasHasta = (dias) => {
  if (dias === null || dias === undefined) return "";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias > 1) return `En ${dias} días`;
  return dias === -1 ? "Ayer" : `Hace ${Math.abs(dias)} días`;
};
