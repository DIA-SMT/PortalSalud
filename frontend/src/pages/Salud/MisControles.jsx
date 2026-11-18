import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Chip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import useCarga from "../../hooks/useCarga";
import { CargandoBloques, ErrorCarga } from "../../components/Salud/Ficha/Comunes";
import ListaControles from "../../components/Salud/Controles/ListaControles";
import CalendarioControles from "../../components/Salud/Controles/CalendarioControles";
import DialogoControl from "../../components/Salud/Controles/DialogoControl";
import { FILTROS_CONTROL } from "../../helpers/estadosControl";

const VACIOS = {
  todos: "Todavía no tenés controles registrados.",
  proximos: "No tenés controles programados.",
  pendientes: "No tenés controles pendientes.",
  realizados: "Todavía no hay controles realizados.",
  cancelados: "No hay controles cancelados.",
};

const MisControles = () => {
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") === "calendario" ? "calendario" : "lista";
  const filtro = FILTROS_CONTROL.find((f) => f.id === params.get("filtro")) || FILTROS_CONTROL[0];
  const { datos, setDatos, cargando, error, recargar } = useCarga("/salud/controles");
  const [elegidoId, setElegidoId] = useState(null);
  const idEnUrl = Number(params.get("control")) || null;

  const actualizar = (cambios) => {
    const siguiente = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => (v === null ? siguiente.delete(k) : siguiente.set(k, v)));
    setParams(siguiente, { replace: true });
  };

  // ?control=ID abre el detalle (por ejemplo, desde un recordatorio).
  useEffect(() => {
    if (idEnUrl && datos) setElegidoId(idEnUrl);
  }, [idEnUrl, datos]);

  const controles = datos?.controles || [];
  const elegido = controles.find((c) => c.id === elegidoId) || null;
  const setElegido = (c) => setElegidoId(c.id);

  const cerrarDetalle = () => {
    setElegidoId(null);
    if (idEnUrl) actualizar({ control: null });
  };

  const alActualizarControl = (actualizado) =>
    setDatos((d) => ({ ...d, controles: d.controles.map((c) => (c.id === actualizado.id ? actualizado : c)) }));
  const filtrados = controles.filter(filtro.incluye);

  const contenido = () => {
    if (cargando) return <CargandoBloques />;
    if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
    if (vista === "calendario") return <CalendarioControles controles={controles} onElegir={setElegido} />;
    return (
      <div className="ps-pila">
        <div className="ps-filtros" role="group" aria-label="Filtrar controles">
          {FILTROS_CONTROL.map((f) => {
            const cantidad = controles.filter(f.incluye).length;
            const activo = f.id === filtro.id;
            return (
              <Chip
                key={f.id}
                label={`${f.texto} (${cantidad})`}
                onClick={() => actualizar({ filtro: f.id })}
                color={activo ? "primary" : "default"}
                variant={activo ? "filled" : "outlined"}
                aria-pressed={activo}
              />
            );
          })}
        </div>
        <section className="cd-superficie ps-tarjeta" aria-label={`Controles: ${filtro.texto}`}>
          {filtrados.length === 0 ? (
            <p className="ps-tarjeta__vacio">{VACIOS[filtro.id]}</p>
          ) : (
            <ListaControles controles={filtrados} onElegir={setElegido} />
          )}
        </section>
      </div>
    );
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Mi Salud"
        titulo="Mis controles"
        subtitulo="Tus controles médicos laborales: fechas, lugares y estado."
        acciones={
          <ToggleButtonGroup
            value={vista}
            exclusive
            size="small"
            onChange={(_e, valor) => valor && actualizar({ vista: valor })}
            aria-label="Forma de ver los controles"
          >
            <ToggleButton value="lista" aria-label="Ver como lista">
              <ViewListRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Lista
            </ToggleButton>
            <ToggleButton value="calendario" aria-label="Ver como calendario">
              <CalendarMonthOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} /> Calendario
            </ToggleButton>
          </ToggleButtonGroup>
        }
      />
      {contenido()}
      <DialogoControl control={elegido} onCerrar={cerrarDetalle} onActualizado={alActualizarControl} />
    </main>
  );
};

export default MisControles;
