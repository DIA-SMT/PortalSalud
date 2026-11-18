const { fechaISO } = require("../utils/fechas");

// Una fecha calendario se ubica al mediodía (hora argentina) para ordenarla junto a los timestamps.
const desdeFecha = (fechaIso) => new Date(`${fechaIso}T12:00:00-03:00`).toISOString();

const TITULOS_CONTROL = {
  realizado: "Control realizado",
  programado: "Control programado",
  reprogramado: "Control reprogramado",
  vencido: "Control con fecha vencida",
  cancelado: "Control cancelado",
};

// Línea de tiempo del titular: controles, documentos y pedidos de reprogramación.
// Usa los servicios ya filtrados por titular; no agrega datos clínicos al detalle.
async function obtenerHistorial({ controles, documentos }, idPersona, ahora = new Date()) {
  const hoy = fechaISO(ahora);
  const [listaControles, listaDocumentos] = await Promise.all([
    controles.listar(idPersona, ahora),
    documentos.listar(idPersona),
  ]);

  const eventos = [];

  for (const c of listaControles) {
    const fecha = c.estado === "realizado" ? c.fechaRealizacion || c.fechaProgramada : c.fechaProgramada;
    if (fecha && TITULOS_CONTROL[c.estado]) {
      eventos.push({
        id: `control-${c.id}`,
        categoria: "control",
        fecha: desdeFecha(fecha),
        soloFecha: true,
        futuro: fecha > hoy,
        titulo: TITULOS_CONTROL[c.estado],
        descripcion: c.tipo,
        responsable: c.responsable,
        lugar: c.lugar,
        estado: c.estado,
        idControl: c.id,
      });
    }
    if (c.solicitudReprogramacion) {
      eventos.push({
        id: `reprogramacion-${c.solicitudReprogramacion.id}`,
        categoria: "reprogramacion",
        fecha: c.solicitudReprogramacion.creadoEn,
        soloFecha: false,
        futuro: false,
        titulo: "Pediste otra fecha",
        descripcion: c.tipo,
        estado: c.solicitudReprogramacion.estado,
        idControl: c.id,
      });
    }
  }

  for (const d of listaDocumentos) {
    eventos.push({
      id: `documento-${d.id}`,
      categoria: "documento",
      fecha: d.creadoEn,
      soloFecha: false,
      futuro: false,
      titulo: d.subidoPorTitular ? "Subiste un documento" : "Se agregó un documento",
      descripcion: d.titulo,
      responsable: d.subidoPorTitular ? null : "Servicio de salud",
      estado: d.estadoValidacion,
      idDocumento: d.id,
      idControl: d.idControl,
    });
  }

  return eventos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

module.exports = { obtenerHistorial };
