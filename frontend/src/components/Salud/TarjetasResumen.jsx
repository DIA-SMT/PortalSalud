/* eslint-disable react/prop-types */
import { useNavigate } from "react-router-dom";
import { Button, LinearProgress } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import TarjetaSalud from "./TarjetaSalud";
import EstadoControlChip from "./EstadoControlChip";
import { diasHasta, formatearFecha, textoDiasHasta } from "../../helpers/fechas";

export const ProximoControl = ({ control }) => (
  <TarjetaSalud
    id="t-proximo"
    icono={<EventAvailableOutlinedIcon fontSize="small" />}
    titulo="Próximo control"
    className="ps-destacado ps-grilla__doble"
  >
    {control ? (
      <>
        <span className="ps-insignia">{textoDiasHasta(diasHasta(control.fechaProgramada))}</span>
        <p className="ps-destacado__tipo">{control.tipo}</p>
        <ul className="ps-destacado__datos">
          <li>
            <CalendarTodayOutlinedIcon aria-hidden="true" />
            {formatearFecha(control.fechaProgramada)}
          </li>
          {control.lugar && (
            <li>
              <PlaceOutlinedIcon aria-hidden="true" />
              {control.lugar}
            </li>
          )}
          {control.responsable && (
            <li>
              <PersonOutlineRoundedIcon aria-hidden="true" />
              {control.responsable}
            </li>
          )}
        </ul>
      </>
    ) : (
      <p className="ps-tarjeta__vacio">No tenés controles programados por ahora.</p>
    )}
    <EnlaceControles texto="Ver todos mis controles" filtro="todos" />
  </TarjetaSalud>
);

// Enlace al listado de controles con un filtro aplicado.
const EnlaceA = ({ texto, ruta }) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="text"
      className="ps-tarjeta__pie align-self-start"
      endIcon={<ChevronRightRoundedIcon />}
      onClick={() => navigate(ruta)}
      sx={{ px: 1, ml: -1 }}
    >
      {texto}
    </Button>
  );
};

const EnlaceControles = ({ texto, filtro }) => <EnlaceA texto={texto} ruta={`/salud/controles?filtro=${filtro}`} />;

const ListaControles = ({ controles, conFechaRealizacion }) => (
  <ul className="ps-lista">
    {controles.map((c) => (
      <li className="ps-lista__item" key={c.id}>
        <span className="ps-lista__textos">
          <span className="ps-lista__principal">{c.tipo}</span>
          <span className="ps-lista__secundario">
            {formatearFecha(conFechaRealizacion ? c.fechaRealizacion : c.fechaProgramada)}
          </span>
        </span>
        <EstadoControlChip estado={c.estado} />
      </li>
    ))}
  </ul>
);

export const ControlesPendientes = ({ pendientes }) => (
  <TarjetaSalud id="t-pendientes" icono={<PendingActionsOutlinedIcon fontSize="small" />} titulo="Controles pendientes">
    {pendientes.cantidad === 0 ? (
      <p className="ps-tarjeta__vacio">No tenés controles pendientes.</p>
    ) : (
      <>
        <p className="ps-tarjeta__vacio">
          {pendientes.cantidad === 1
            ? "Tenés 1 control para coordinar."
            : `Tenés ${pendientes.cantidad} controles para coordinar.`}
        </p>
        <ListaControles controles={pendientes.items} />
        <EnlaceControles texto="Ver pendientes" filtro="pendientes" />
      </>
    )}
  </TarjetaSalud>
);

export const UltimosControles = ({ controles }) => (
  <TarjetaSalud id="t-ultimos" icono={<HistoryRoundedIcon fontSize="small" />} titulo="Últimos controles">
    {controles.length === 0 ? (
      <p className="ps-tarjeta__vacio">Todavía no hay controles registrados.</p>
    ) : (
      <>
        <ListaControles controles={controles} conFechaRealizacion />
        <EnlaceControles texto="Ver historial" filtro="realizados" />
      </>
    )}
  </TarjetaSalud>
);

export const Recordatorios = ({ recordatorios }) => (
  <TarjetaSalud
    id="t-recordatorios"
    icono={<NotificationsNoneRoundedIcon fontSize="small" />}
    titulo="Recordatorios"
  >
    {recordatorios.length === 0 ? (
      <p className="ps-tarjeta__vacio">No tenés recordatorios nuevos.</p>
    ) : (
      <ul className="ps-lista">
        {recordatorios.map((r) => (
          <li className="ps-lista__item" key={r.id}>
            <span className="ps-lista__textos">
              <span className="ps-lista__principal">{r.titulo}</span>
              <span className="ps-lista__secundario">{r.mensaje}</span>
            </span>
          </li>
        ))}
      </ul>
    )}
    <EnlaceA texto="Ver recordatorios" ruta="/salud/recordatorios" />
  </TarjetaSalud>
);

export const Documentos = ({ documentos }) => (
  <TarjetaSalud id="t-documentos" icono={<DescriptionOutlinedIcon fontSize="small" />} titulo="Documentos">
    <div className="ps-cifras">
      <div>
        <span className="ps-cifra__valor">{documentos.disponibles}</span>
        <span className="ps-cifra__etiqueta">Disponibles</span>
      </div>
      <div>
        <span className="ps-cifra__valor">{documentos.pendientesValidacion}</span>
        <span className="ps-cifra__etiqueta">Pendientes de validación</span>
      </div>
    </div>
    <EnlaceA texto="Ver documentos" ruta="/salud/documentos" />
  </TarjetaSalud>
);

// Dónde se completa cada ítem de la ficha.
const RUTA_POR_ITEM = {
  contactos_emergencia: "/salud/ficha?seccion=personales",
  datos_contacto: "/salud/ficha?seccion=personales",
  informacion_salud: "/salud/ficha?seccion=salud",
  preferencias: "/salud/recordatorios#preferencias",
};

export const Completitud = ({ completitud }) => {
  const navigate = useNavigate();
  const pendiente = completitud.items.find((i) => !i.completo && RUTA_POR_ITEM[i.clave]);
  const destino = pendiente ? RUTA_POR_ITEM[pendiente.clave] : "/salud/ficha";

  return (
    <TarjetaSalud id="t-ficha" icono={<AssignmentIndOutlinedIcon fontSize="small" />} titulo="Tu ficha">
      <div>
        <div className="d-flex justify-content-between mb-1">
          <span className="ps-cifra__etiqueta">Datos completados</span>
          <strong>{completitud.porcentaje}%</strong>
        </div>
        <LinearProgress
          variant="determinate"
          value={completitud.porcentaje}
          aria-label="Porcentaje de la ficha completado"
          sx={{ height: 8, borderRadius: 999 }}
        />
      </div>
      <ul className="ps-checklist">
        {completitud.items.map((item) => (
          <li key={item.clave}>
            {item.completo ? (
              <CheckCircleRoundedIcon className="ps-checklist__ok" aria-hidden="true" />
            ) : (
              <RadioButtonUncheckedRoundedIcon className="ps-checklist__falta" aria-hidden="true" />
            )}
            <span>
              {item.etiqueta}
              <span className="visually-hidden">{item.completo ? " (completo)" : " (pendiente)"}</span>
            </span>
          </li>
        ))}
      </ul>
      <Button
        variant={pendiente ? "contained" : "outlined"}
        className="ps-tarjeta__pie align-self-start"
        endIcon={<ChevronRightRoundedIcon />}
        onClick={() => navigate(destino)}
      >
        {pendiente ? "Completar mi ficha" : "Ver mi ficha"}
      </Button>
    </TarjetaSalud>
  );
};
