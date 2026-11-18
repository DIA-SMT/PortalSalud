/* eslint-disable react/prop-types */
import { useNavigate } from "react-router-dom";
import { Button, Chip } from "@mui/material";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import EstadoControlChip from "../EstadoControlChip";
import { ValidacionChip } from "../Ficha/Comunes";

const ICONOS = {
  control: <EventAvailableOutlinedIcon fontSize="small" />,
  documento: <DescriptionOutlinedIcon fontSize="small" />,
  reprogramacion: <EventRepeatRoundedIcon fontSize="small" />,
};
const ESTADOS_PEDIDO = { pendiente: "Pendiente de respuesta", aceptada: "Aceptado", rechazada: "No aceptado" };

const FORMATO_MES = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
const FORMATO_DIA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const FORMATO_HORA = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });
const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const EstadoEvento = ({ evento }) => {
  if (evento.categoria === "control") return <EstadoControlChip estado={evento.estado} />;
  if (evento.categoria === "documento") return <ValidacionChip estado={evento.estado} />;
  return <Chip size="small" label={ESTADOS_PEDIDO[evento.estado] || evento.estado} sx={{ bgcolor: "var(--cd-hover)", color: "var(--cd-text)" }} />;
};

// Línea de tiempo agrupada por mes, del evento más reciente al más antiguo.
const LineaTiempo = ({ eventos }) => {
  const navigate = useNavigate();
  const grupos = [];
  for (const e of eventos) {
    const mes = capitalizar(FORMATO_MES.format(new Date(e.fecha)));
    const ultimo = grupos.at(-1);
    if (ultimo?.mes === mes) ultimo.eventos.push(e);
    else grupos.push({ mes, eventos: [e] });
  }

  return (
    <div className="ps-pila">
      {grupos.map((g) => (
        <section key={g.mes} className="cd-superficie ps-tarjeta" aria-label={g.mes}>
          <h2 className="ps-tarjeta__titulo">{g.mes}</h2>
          <ol className="ps-linea">
            {g.eventos.map((e) => {
              const fecha = new Date(e.fecha);
              return (
                <li key={e.id} className={`ps-linea__evento${e.futuro ? " ps-linea__evento--futuro" : ""}`}>
                  <span className="ps-linea__icono" aria-hidden="true">
                    {ICONOS[e.categoria]}
                  </span>
                  <div className="ps-linea__cuerpo">
                    <p className="ps-linea__titulo">
                      {e.titulo}
                      {e.futuro && <span className="ps-insignia ms-2">Próximo</span>}
                    </p>
                    <p className="ps-lista__principal mb-0">{e.descripcion}</p>
                    <p className="ps-lista__secundario mb-1">
                      <time dateTime={e.fecha}>
                        {FORMATO_DIA.format(fecha)}
                        {e.soloFecha ? "" : ` · ${FORMATO_HORA.format(fecha)}`}
                      </time>
                      {e.lugar ? ` · ${e.lugar}` : ""}
                      {e.responsable ? ` · ${e.responsable}` : ""}
                    </p>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <EstadoEvento evento={e} />
                      {e.idControl && (
                        <Button size="small" onClick={() => navigate(`/salud/controles?control=${e.idControl}`)}>
                          Ver control
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default LineaTiempo;
