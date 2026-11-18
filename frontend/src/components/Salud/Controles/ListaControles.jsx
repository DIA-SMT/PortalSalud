/* eslint-disable react/prop-types */
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EstadoControlChip from "../EstadoControlChip";
import { desdeISO } from "../../../helpers/fechas";
import { fechaDelControl } from "../../../helpers/estadosControl";

const MES_CORTO = new Intl.DateTimeFormat("es-AR", { month: "short" });

const BloqueFecha = ({ fechaIso }) => {
  const fecha = desdeISO(fechaIso);
  if (!fecha) {
    return (
      <span className="ps-fecha ps-fecha--vacia" aria-hidden="true">
        <span className="ps-fecha__dia">—</span>
        <span className="ps-fecha__mes">s/f</span>
      </span>
    );
  }
  return (
    <span className="ps-fecha" aria-hidden="true">
      <span className="ps-fecha__dia">{fecha.getDate()}</span>
      <span className="ps-fecha__mes">
        {MES_CORTO.format(fecha).replace(".", "")} {String(fecha.getFullYear()).slice(2)}
      </span>
    </span>
  );
};

const FORMATO_LARGO = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });

// Lista de controles; cada fila abre el detalle.
const ListaControles = ({ controles, onElegir }) => (
  <ul className="ps-controles">
    {controles.map((c) => {
      const fecha = fechaDelControl(c);
      const etiquetaFecha = fecha ? FORMATO_LARGO.format(desdeISO(fecha)) : "sin fecha asignada";
      return (
        <li key={c.id}>
          <button
            type="button"
            className="ps-control"
            onClick={() => onElegir(c)}
            aria-label={`${c.tipo}, ${etiquetaFecha}. Ver detalle`}
          >
            <BloqueFecha fechaIso={fecha} />
            <span className="ps-lista__textos ps-control__textos">
              <span className="ps-lista__principal">{c.tipo}</span>
              <span className="ps-lista__secundario">{c.lugar || "Lugar a confirmar"}</span>
            </span>
            <EstadoControlChip estado={c.estado} />
            <ChevronRightRoundedIcon className="ps-control__chevron" aria-hidden="true" />
          </button>
        </li>
      );
    })}
  </ul>
);

export default ListaControles;
