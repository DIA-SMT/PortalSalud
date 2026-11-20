import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Chip, IconButton, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import Swal from "../../common/alerta";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useCarga from "../../hooks/useCarga";
import useSaludStore from "../../Zustand/useSaludStore";
import { avisarError, avisarExito } from "../../helpers/avisos";
import { formatearFecha, hoyISO } from "../../helpers/fechas";
import { gestionaAgenda } from "../../helpers/roles";
import EstadoControlChip from "../../components/Salud/EstadoControlChip";
import { CargandoBloques, ErrorCarga } from "../../components/Salud/Ficha/Comunes";
import DialogoNuevoControl from "../../components/Gestion/Agenda/DialogoNuevoControl";
import DialogoAccion from "../../components/Gestion/Agenda/DialogoAccion";

const PERIODOS = [
  { id: "proximos", texto: "Próximos 30 días", consulta: () => `desde=${hoyISO()}&hasta=${hoyISO(30)}` },
  { id: "vencidos", texto: "Vencidos", consulta: () => "estado=vencido" },
  { id: "sin_fecha", texto: "Sin fecha", consulta: () => "estado=pendiente" },
  { id: "todos", texto: "Todos", consulta: () => "" },
];
const CERRADOS = ["realizado", "cancelado"];
const EXITOS = {
  reprogramar: "Control reprogramado",
  realizado: "Control registrado como realizado",
  aceptar: "Pedido aceptado y control reprogramado",
  rechazar: "Pedido rechazado",
};
const FORMATO_PEDIDO = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Agrupa por fecha programada (los sin fecha, al final).
const agrupar = (controles) => {
  const grupos = new Map();
  for (const c of controles) {
    const clave = c.fechaProgramada || "sin_fecha";
    grupos.set(clave, [...(grupos.get(clave) || []), c]);
  }
  return [...grupos.entries()].sort(([a], [b]) => (a === "sin_fecha" ? 1 : b === "sin_fecha" ? -1 : a.localeCompare(b)));
};

const Agenda = () => {
  const roles = useSaludStore((s) => s.roles);
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") === "pedidos" ? "pedidos" : "agenda";
  const periodo = PERIODOS.find((p) => p.id === params.get("periodo")) || PERIODOS[0];
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [accion, setAccion] = useState(null);

  const url = `/gestion/agenda?${[periodo.consulta(), consulta && `buscar=${encodeURIComponent(consulta)}`].filter(Boolean).join("&")}`;
  const agenda = useCarga(url);
  const pedidos = useCarga("/gestion/agenda/pedidos");

  useEffect(() => {
    const id = setTimeout(() => setConsulta(busqueda.trim()), 350);
    return () => clearTimeout(id);
  }, [busqueda]);

  const grupos = useMemo(() => agrupar(agenda.datos?.controles || []), [agenda.datos]);
  const cantidadPedidos = pedidos.datos?.pedidos.length || 0;

  if (!gestionaAgenda(roles)) {
    return (
      <main className="ps-pagina">
        <EncabezadoPagina volver="/salud" titulo="Agenda de controles" />
        <Alert severity="warning">No tenés permiso para gestionar la agenda de controles.</Alert>
      </main>
    );
  }

  const actualizar = (cambios) => {
    const siguiente = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => siguiente.set(k, v));
    setParams(siguiente, { replace: true });
  };

  const recargarTodo = () => {
    agenda.recargar();
    pedidos.recargar();
  };

  const alTerminarAccion = (modo) => {
    setAccion(null);
    avisarExito(EXITOS[modo]);
    recargarTodo();
  };

  const cancelar = async (c) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Cancelar el control?",
      text: `${c.tipo} de ${c.empleado.nombre}. El empleado recibe un aviso.`,
      showCancelButton: true,
      confirmButtonText: "Cancelar control",
      cancelButtonText: "Volver",
      confirmButtonColor: "var(--cd-peligro)",
      cancelButtonColor: "var(--cd-text-3)",
      focusCancel: true,
    });
    if (!isConfirmed) return;
    try {
      await axiosSalud.post(`/gestion/agenda/${c.id}/cancelacion`);
      avisarExito("Control cancelado");
      recargarTodo();
    } catch (e) {
      avisarError(mensajeDeError(e));
    }
  };

  const describir = (c) => `${c.tipo} · ${c.empleado.nombre} (legajo ${c.empleado.legajo ?? "—"})`;

  const contenidoAgenda = () => (
    <div className="ps-pila">
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <div className="ps-filtros" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <Chip
              key={p.id}
              label={p.texto}
              onClick={() => actualizar({ periodo: p.id })}
              color={p.id === periodo.id ? "primary" : "default"}
              variant={p.id === periodo.id ? "filled" : "outlined"}
              aria-pressed={p.id === periodo.id}
            />
          ))}
        </div>
        <TextField
          size="small"
          placeholder="Buscar empleado, legajo o tipo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          inputProps={{ "aria-label": "Buscar en la agenda", maxLength: 80 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 240, flex: "1 1 240px", maxWidth: 360 }}
        />
      </div>

      {agenda.cargando && !agenda.datos && <CargandoBloques />}
      {agenda.error && <ErrorCarga error={agenda.error} onReintentar={agenda.recargar} />}
      {agenda.datos && grupos.length === 0 && (
        <section className="cd-superficie ps-tarjeta">
          <p className="ps-tarjeta__vacio">No hay controles para este filtro.</p>
        </section>
      )}
      {grupos.map(([fecha, controles]) => (
        <section key={fecha} className="cd-superficie ps-tarjeta" aria-label={fecha === "sin_fecha" ? "Sin fecha" : formatearFecha(fecha)}>
          <h2 className="ps-tarjeta__titulo">{fecha === "sin_fecha" ? "Sin fecha asignada" : formatearFecha(fecha)}</h2>
          <ul className="ps-lista">
            {controles.map((c) => (
              <li key={c.id} className="ps-lista__item ps-agenda__item">
                <span className="ps-lista__textos">
                  <span className="ps-lista__principal">{c.empleado.nombre}</span>
                  <span className="ps-lista__secundario">
                    Legajo {c.empleado.legajo ?? "—"} · {c.empleado.reparticion || "Sin repartición"}
                  </span>
                  <span className="ps-lista__secundario">
                    {c.tipo}
                    {c.lugar ? ` · ${c.lugar}` : ""}
                  </span>
                  <span className="d-flex flex-wrap gap-1 mt-1">
                    <EstadoControlChip estado={c.estado} />
                    {c.pedidoReprogramacion && (
                      <Chip size="small" label="Pidió cambiar la fecha" sx={{ bgcolor: "var(--cd-amarillo-bg)", color: "var(--cd-text)" }} />
                    )}
                  </span>
                </span>
                {!CERRADOS.includes(c.estado) && (
                  <span className="cd-acciones">
                    <Tooltip title={c.fechaProgramada ? "Reprogramar" : "Asignar fecha"}>
                      <IconButton aria-label={`Reprogramar: ${describir(c)}`} onClick={() => setAccion({ modo: "reprogramar", objetivo: c, descripcion: describir(c) })}>
                        <EventRepeatRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Registrar realizado">
                      <IconButton aria-label={`Registrar realizado: ${describir(c)}`} onClick={() => setAccion({ modo: "realizado", objetivo: c, descripcion: describir(c) })}>
                        <TaskAltRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancelar">
                      <IconButton aria-label={`Cancelar: ${describir(c)}`} onClick={() => cancelar(c)}>
                        <EventBusyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  const contenidoPedidos = () => {
    if (pedidos.cargando && !pedidos.datos) return <CargandoBloques />;
    if (pedidos.error) return <ErrorCarga error={pedidos.error} onReintentar={pedidos.recargar} />;
    if (!cantidadPedidos) {
      return (
        <section className="cd-superficie ps-tarjeta">
          <p className="ps-tarjeta__vacio">No hay pedidos de cambio de fecha pendientes.</p>
        </section>
      );
    }
    return (
      <section className="cd-superficie ps-tarjeta" aria-label="Pedidos de cambio de fecha">
        <ul className="ps-lista">
          {pedidos.datos.pedidos.map((p) => {
            const descripcion = `${p.control.tipo} · ${p.empleado.nombre} (legajo ${p.empleado.legajo ?? "—"}) · fecha actual: ${formatearFecha(p.control.fechaProgramada)}`;
            return (
              <li key={p.id} className="ps-correccion">
                <div className="ps-correccion__cabecera">
                  <span className="ps-lista__textos">
                    <span className="ps-lista__principal">{p.empleado.nombre}</span>
                    <span className="ps-lista__secundario">
                      Legajo {p.empleado.legajo ?? "—"} · {p.empleado.reparticion || "Sin repartición"} · pedido el{" "}
                      {FORMATO_PEDIDO.format(new Date(p.creadoEn))}
                    </span>
                  </span>
                  <EstadoControlChip estado={p.control.estado} />
                </div>
                <p className="ps-dato__titulo mb-0">
                  {p.control.tipo} · fecha actual: {formatearFecha(p.control.fechaProgramada)}
                </p>
                <p className="ps-cambio__valor mb-0">“{p.motivo}”</p>
                <div className="d-flex flex-wrap gap-2">
                  <Button size="small" variant="contained" onClick={() => setAccion({ modo: "aceptar", objetivo: p, descripcion })}>
                    Aceptar con nueva fecha
                  </Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => setAccion({ modo: "rechazar", objetivo: p, descripcion })}>
                    Rechazar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Salud laboral"
        titulo="Agenda de controles"
        subtitulo="Programá, reprogramá y registrá los controles de los empleados de tu ámbito."
        acciones={
          <>
            <ToggleButtonGroup value={vista} exclusive size="small" onChange={(_e, v) => v && actualizar({ vista: v })} aria-label="Qué ver">
              <ToggleButton value="agenda">Agenda</ToggleButton>
              <ToggleButton value="pedidos" aria-label={`Pedidos de cambio de fecha: ${cantidadPedidos}`}>
                <Badge badgeContent={cantidadPedidos} color="primary" sx={{ "& .MuiBadge-badge": { right: -10 } }}>
                  Pedidos
                </Badge>
              </ToggleButton>
            </ToggleButtonGroup>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setNuevo(true)}>
              Nuevo control
            </Button>
          </>
        }
      />
      {vista === "pedidos" ? contenidoPedidos() : contenidoAgenda()}

      <DialogoNuevoControl
        abierto={nuevo}
        tiposSugeridos={agenda.datos?.tiposSugeridos}
        onCerrar={() => setNuevo(false)}
        onCreado={() => {
          setNuevo(false);
          avisarExito("Control programado");
          recargarTodo();
        }}
      />
      <DialogoAccion accion={accion} onCerrar={() => setAccion(null)} onHecho={alTerminarAccion} />
    </main>
  );
};

export default Agenda;
