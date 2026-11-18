// Estados administrativos de un control. Colores sobrios: "vencido" no usa rojo
// para no transmitir alarma clínica (es solo una fecha que pasó).
export const ESTADOS_CONTROL = {
  programado: { texto: "Programado", bg: "var(--cd-azul-bg)", color: "var(--cd-accent-fuerte)", punto: "var(--cd-accent)" },
  reprogramado: { texto: "Reprogramado", bg: "var(--cd-violeta-bg)", color: "var(--cd-violeta)", punto: "var(--cd-violeta)" },
  pendiente: { texto: "Pendiente", bg: "var(--cd-naranja-bg)", color: "var(--cd-text)", punto: "var(--cd-naranja)" },
  vencido: { texto: "Vencido", bg: "var(--cd-naranja-bg)", color: "var(--cd-text)", punto: "var(--cd-naranja)" },
  realizado: { texto: "Realizado", bg: "var(--cd-verde-bg)", color: "var(--cd-text)", punto: "var(--cd-verde)" },
  cancelado: { texto: "Cancelado", bg: "var(--cd-hover)", color: "var(--cd-text-2)", punto: "var(--cd-text-3)" },
};

export const FILTROS_CONTROL = [
  { id: "todos", texto: "Todos", incluye: () => true },
  { id: "proximos", texto: "Próximos", incluye: (c) => ["programado", "reprogramado"].includes(c.estado) },
  { id: "pendientes", texto: "Pendientes", incluye: (c) => ["pendiente", "vencido"].includes(c.estado) },
  { id: "realizados", texto: "Realizados", incluye: (c) => c.estado === "realizado" },
  { id: "cancelados", texto: "Cancelados", incluye: (c) => c.estado === "cancelado" },
];

// Fecha que ubica al control en el calendario: la de realización si ya se hizo.
export const fechaDelControl = (c) => (c.estado === "realizado" && c.fechaRealizacion) || c.fechaProgramada || null;
