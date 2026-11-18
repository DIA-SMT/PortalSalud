/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ListaControles from "./ListaControles";
import { ESTADOS_CONTROL, fechaDelControl } from "../../../helpers/estadosControl";

const DIAS_SEMANA = [
  { corto: "L", largo: "lunes" },
  { corto: "M", largo: "martes" },
  { corto: "M", largo: "miércoles" },
  { corto: "J", largo: "jueves" },
  { corto: "V", largo: "viernes" },
  { corto: "S", largo: "sábado" },
  { corto: "D", largo: "domingo" },
];
const FORMATO_MES = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
const FORMATO_DIA = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const iso = (anio, mes, dia) => `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
const hoyIso = () => {
  const h = new Date();
  return iso(h.getFullYear(), h.getMonth(), h.getDate());
};

// Calendario mensual (lunes a domingo) con los controles marcados por estado.
const CalendarioControles = ({ controles, onElegir }) => {
  const hoy = hoyIso();
  const [mes, setMes] = useState(() => {
    const h = new Date();
    return { anio: h.getFullYear(), mes: h.getMonth() };
  });
  const [seleccionado, setSeleccionado] = useState(hoy);

  const porFecha = useMemo(() => {
    const mapa = new Map();
    for (const c of controles) {
      const f = fechaDelControl(c);
      if (!f) continue;
      mapa.set(f, [...(mapa.get(f) || []), c]);
    }
    return mapa;
  }, [controles]);

  const sinFecha = controles.filter((c) => !fechaDelControl(c));

  const primerDia = new Date(mes.anio, mes.mes, 1);
  const desplazamiento = (primerDia.getDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(mes.anio, mes.mes + 1, 0).getDate();
  const celdas = [
    ...Array.from({ length: desplazamiento }, () => null),
    ...Array.from({ length: diasDelMes }, (_v, i) => i + 1),
  ];
  while (celdas.length % 7) celdas.push(null);
  const semanas = Array.from({ length: celdas.length / 7 }, (_v, s) => celdas.slice(s * 7, s * 7 + 7));

  const mover = (delta) =>
    setMes(({ anio, mes: m }) => {
      const d = new Date(anio, m + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });

  const delDia = porFecha.get(seleccionado) || [];
  const fechaSeleccionada = new Date(`${seleccionado}T12:00:00`);

  return (
    <div className="ps-pila">
      <section className="cd-superficie ps-tarjeta" aria-label="Calendario de controles">
        <div className="ps-calendario__cabecera">
          <Tooltip title="Mes anterior">
            <IconButton onClick={() => mover(-1)} aria-label="Mes anterior">
              <ChevronLeftRoundedIcon />
            </IconButton>
          </Tooltip>
          <h2 className="ps-calendario__mes" aria-live="polite">
            {capitalizar(FORMATO_MES.format(primerDia))}
          </h2>
          <Tooltip title="Mes siguiente">
            <IconButton onClick={() => mover(1)} aria-label="Mes siguiente">
              <ChevronRightRoundedIcon />
            </IconButton>
          </Tooltip>
        </div>

        <div className="ps-calendario" role="grid" aria-label={FORMATO_MES.format(primerDia)}>
          <div role="row" className="ps-calendario__fila">
            {DIAS_SEMANA.map((d) => (
              <span role="columnheader" key={d.largo} className="ps-calendario__semana" title={d.largo}>
                <abbr title={d.largo}>{d.corto}</abbr>
              </span>
            ))}
          </div>
          {semanas.map((semana, s) => (
            <div role="row" className="ps-calendario__fila" key={`s-${s}`}>
              {semana.map((dia, i) => {
                if (!dia) return <span key={`v-${s}-${i}`} role="gridcell" className="ps-calendario__vacio" />;
                const fecha = iso(mes.anio, mes.mes, dia);
                const items = porFecha.get(fecha) || [];
                const etiqueta = `${FORMATO_DIA.format(new Date(mes.anio, mes.mes, dia))}${
                  items.length ? `, ${items.length} ${items.length === 1 ? "control" : "controles"}` : ""
                }`;
                const clases = [
                  "ps-calendario__dia",
                  fecha === hoy ? "ps-calendario__dia--hoy" : "",
                  fecha === seleccionado ? "ps-calendario__dia--elegido" : "",
                ].join(" ");
                return (
                  <span role="gridcell" key={fecha}>
                    <button
                      type="button"
                      className={clases}
                      onClick={() => setSeleccionado(fecha)}
                      aria-label={etiqueta}
                      aria-pressed={fecha === seleccionado}
                      aria-current={fecha === hoy ? "date" : undefined}
                    >
                      <span>{dia}</span>
                      {items.length > 0 && (
                        <span className="ps-calendario__puntos" aria-hidden="true">
                          {items.slice(0, 3).map((c) => (
                            <span key={c.id} style={{ background: ESTADOS_CONTROL[c.estado]?.punto }} />
                          ))}
                        </span>
                      )}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="cd-superficie ps-tarjeta" aria-labelledby="t-dia">
        <h2 className="ps-tarjeta__titulo" id="t-dia">
          {capitalizar(FORMATO_DIA.format(fechaSeleccionada))}
        </h2>
        {delDia.length === 0 ? (
          <p className="ps-tarjeta__vacio">No tenés controles este día.</p>
        ) : (
          <ListaControles controles={delDia} onElegir={onElegir} />
        )}
      </section>

      {sinFecha.length > 0 && (
        <section className="cd-superficie ps-tarjeta" aria-labelledby="t-sin-fecha">
          <h2 className="ps-tarjeta__titulo" id="t-sin-fecha">
            Sin fecha asignada
          </h2>
          <p className="ps-tarjeta__vacio">El servicio de salud te va a avisar cuando les asigne fecha.</p>
          <ListaControles controles={sinFecha} onElegir={onElegir} />
        </section>
      )}
    </div>
  );
};

export default CalendarioControles;
