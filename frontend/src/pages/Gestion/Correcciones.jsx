import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Chip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import EastRoundedIcon from "@mui/icons-material/EastRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useCarga from "../../hooks/useCarga";
import useSaludStore from "../../Zustand/useSaludStore";
import { avisarError, avisarExito } from "../../helpers/avisos";
import { esRevisor } from "../../helpers/roles";
import { CargandoBloques, ErrorCarga } from "../../components/Salud/Ficha/Comunes";
import DialogoReversion from "../../components/Gestion/DialogoReversion";

const ACCIONES = { crear: "Agregó", modificar: "Modificó", baja: "Quitó" };
const ESTADOS = {
  pendiente: { texto: "Pendiente", bg: "var(--cd-amarillo-bg)" },
  revisada: { texto: "Revisada", bg: "var(--cd-verde-bg)" },
  revertida: { texto: "Restaurada", bg: "var(--cd-hover)" },
};
const FORMATO = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// eslint-disable-next-line react/prop-types
const Valor = ({ valor, nuevo }) => (
  <span className={`ps-cambio__valor${nuevo ? " ps-cambio__valor--nuevo" : ""}${valor ? "" : " ps-cambio__valor--vacio"}`}>
    {valor || "Sin dato"}
  </span>
);

// Bandeja de correcciones que hicieron los empleados sobre su ficha.
const Correcciones = () => {
  const roles = useSaludStore((s) => s.roles);
  const [params, setParams] = useSearchParams();
  const estado = params.get("estado") === "todas" ? "todas" : "pendientes";
  const { datos, setDatos, cargando, error, recargar } = useCarga(`/gestion/correcciones?estado=${estado}`);
  const [aRevertir, setARevertir] = useState(null);
  const [procesando, setProcesando] = useState(null);

  if (!esRevisor(roles)) {
    return (
      <main className="ps-pagina">
        <EncabezadoPagina volver="/salud" titulo="Correcciones de fichas" />
        <Alert severity="warning">No tenés permiso para revisar correcciones.</Alert>
      </main>
    );
  }

  const resolver = async (correccion, decision, nota) => {
    setProcesando(correccion.id);
    try {
      const { data } = await axiosSalud.post(`/gestion/correcciones/${correccion.id}/resolucion`, { decision, nota });
      setDatos((d) => ({
        ...d,
        correcciones:
          estado === "pendientes"
            ? d.correcciones.filter((c) => c.id !== correccion.id)
            : d.correcciones.map((c) => (c.id === correccion.id ? data : c)),
      }));
      useSaludStore.getState().actualizarPendientesRevision?.();
      avisarExito(decision === "revertir" ? "Dato restaurado" : "Marcada como revisada");
    } catch (e) {
      avisarError(mensajeDeError(e));
    }
    setProcesando(null);
    setARevertir(null);
  };

  const contenido = () => {
    if (cargando) return <CargandoBloques />;
    if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
    const { correcciones } = datos;
    if (correcciones.length === 0) {
      return (
        <section className="cd-superficie ps-tarjeta">
          <p className="ps-tarjeta__vacio">
            {estado === "pendientes" ? "No hay correcciones pendientes de revisión." : "Todavía no hay correcciones."}
          </p>
        </section>
      );
    }
    return (
      <section className="cd-superficie ps-tarjeta" aria-label="Correcciones">
        <ul className="ps-lista">
          {correcciones.map((c) => (
            <li key={c.id} className="ps-correccion">
              <div className="ps-correccion__cabecera">
                <span className="ps-lista__textos">
                  <span className="ps-lista__principal">{c.persona.nombre}</span>
                  <span className="ps-lista__secundario">
                    {c.persona.legajo ? `Legajo ${c.persona.legajo} · ` : ""}
                    {c.persona.reparticion || "Sin repartición"} · {FORMATO.format(new Date(c.actualizadoEn))}
                  </span>
                </span>
                <span className="d-flex flex-wrap gap-1">
                  {c.tipo === "clinica" && (
                    <Chip size="small" label="Confidencial" sx={{ bgcolor: "var(--cd-violeta-bg)", color: "var(--cd-text)" }} />
                  )}
                  <Chip size="small" label={ESTADOS[c.estado]?.texto} sx={{ bgcolor: ESTADOS[c.estado]?.bg, color: "var(--cd-text)" }} />
                </span>
              </div>
              <p className="ps-dato__titulo mb-0">
                {c.seccion} · {ACCIONES[c.accion] || "Modificó"} {c.campo.toLowerCase()}
              </p>
              <div className="ps-cambio">
                <Valor valor={c.valorAnterior} />
                <EastRoundedIcon className="ps-cambio__flecha" aria-label="cambió a" />
                <Valor valor={c.accion === "baja" ? null : c.valorNuevo} nuevo />
              </div>
              {c.nota && <p className="ps-lista__secundario mb-0">Nota: {c.nota}</p>}
              {c.estado === "pendiente" && (
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckRoundedIcon />}
                    disabled={procesando === c.id}
                    onClick={() => resolver(c, "revisada")}
                  >
                    Marcar como revisada
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<UndoRoundedIcon />}
                    disabled={procesando === c.id}
                    onClick={() => setARevertir(c)}
                  >
                    Restaurar dato anterior
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Capital Humano"
        titulo="Correcciones de fichas"
        subtitulo="Cambios que hicieron los empleados sobre datos cargados por el área. Revisalos o restaurá el dato anterior."
        acciones={
          <ToggleButtonGroup
            value={estado}
            exclusive
            size="small"
            onChange={(_e, valor) => valor && setParams({ estado: valor }, { replace: true })}
            aria-label="Qué correcciones ver"
          >
            <ToggleButton value="pendientes">Pendientes</ToggleButton>
            <ToggleButton value="todas">Todas</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      {contenido()}
      <DialogoReversion
        correccion={aRevertir}
        onCerrar={() => setARevertir(null)}
        onConfirmar={(nota) => resolver(aRevertir, "revertir", nota)}
      />
    </main>
  );
};

export default Correcciones;
