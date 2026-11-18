import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Chip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import { confirmarBorrado } from "../../common/alerta";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useCarga from "../../hooks/useCarga";
import { avisarError, avisarExito } from "../../helpers/avisos";
import { CargandoBloques, ErrorCarga } from "../../components/Salud/Ficha/Comunes";
import ListaDocumentos from "../../components/Salud/Documentos/ListaDocumentos";
import DialogoSubida from "../../components/Salud/Documentos/DialogoSubida";
import LineaTiempo from "../../components/Salud/Documentos/LineaTiempo";

const FILTROS = [
  { id: "todos", texto: "Todos", incluye: () => true },
  { id: "pendientes", texto: "Pendientes de validación", incluye: (d) => d.estadoValidacion === "pendiente" },
  { id: "validados", texto: "Validados", incluye: (d) => d.estadoValidacion === "validado" },
];

const HistorialDocumentos = () => {
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") === "historial" ? "historial" : "documentos";
  const filtro = FILTROS.find((f) => f.id === params.get("filtro")) || FILTROS[0];
  const docs = useCarga("/salud/documentos");
  const historial = useCarga("/salud/historial");
  const controles = useCarga("/salud/controles");
  const [subiendo, setSubiendo] = useState(false);

  const actualizar = (cambios) => {
    const siguiente = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => siguiente.set(k, v));
    setParams(siguiente, { replace: true });
  };

  const alSubir = (doc) => {
    docs.setDatos((d) => ({ ...d, documentos: [doc, ...d.documentos] }));
    historial.recargar();
    setSubiendo(false);
    avisarExito("Documento subido. Queda pendiente de validación.");
  };

  const retirar = async (doc) => {
    const { isConfirmed } = await confirmarBorrado({
      title: "¿Retirar documento?",
      text: `Se eliminará "${doc.titulo}". Podés volver a subirlo después.`,
      confirmButtonText: "Retirar",
    });
    if (!isConfirmed) return;
    try {
      await axiosSalud.delete(`/salud/documentos/${doc.id}`);
      docs.setDatos((d) => ({ ...d, documentos: d.documentos.filter((x) => x.id !== doc.id) }));
      historial.recargar();
      avisarExito("Documento retirado");
    } catch (error) {
      avisarError(mensajeDeError(error));
    }
  };

  const contenidoDocumentos = () => {
    if (docs.cargando) return <CargandoBloques />;
    if (docs.error) return <ErrorCarga error={docs.error} onReintentar={docs.recargar} />;
    const lista = docs.datos.documentos;
    const filtrados = lista.filter(filtro.incluye);
    return (
      <div className="ps-pila">
        <div className="ps-filtros" role="group" aria-label="Filtrar documentos">
          {FILTROS.map((f) => {
            const activo = f.id === filtro.id;
            return (
              <Chip
                key={f.id}
                label={`${f.texto} (${lista.filter(f.incluye).length})`}
                onClick={() => actualizar({ filtro: f.id })}
                color={activo ? "primary" : "default"}
                variant={activo ? "filled" : "outlined"}
                aria-pressed={activo}
              />
            );
          })}
        </div>
        <section className="cd-superficie ps-tarjeta" aria-label="Documentos">
          {filtrados.length === 0 ? (
            <p className="ps-tarjeta__vacio">
              {lista.length === 0 ? "Todavía no hay documentos. Podés subir el primero." : "No hay documentos con este filtro."}
            </p>
          ) : (
            <ListaDocumentos documentos={filtrados} onRetirar={retirar} />
          )}
        </section>
      </div>
    );
  };

  const contenidoHistorial = () => {
    if (historial.cargando) return <CargandoBloques />;
    if (historial.error) return <ErrorCarga error={historial.error} onReintentar={historial.recargar} />;
    if (historial.datos.eventos.length === 0) {
      return (
        <section className="cd-superficie ps-tarjeta">
          <p className="ps-tarjeta__vacio">Todavía no hay movimientos en tu historial.</p>
        </section>
      );
    }
    return <LineaTiempo eventos={historial.datos.eventos} />;
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Mi Salud"
        titulo="Historial y documentos"
        subtitulo="Tus estudios, certificados, informes y constancias, y la historia de tus controles."
        acciones={
          <>
            <ToggleButtonGroup
              value={vista}
              exclusive
              size="small"
              onChange={(_e, valor) => valor && actualizar({ vista: valor })}
              aria-label="Qué ver"
            >
              <ToggleButton value="documentos" aria-label="Ver documentos">
                <FolderOpenOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} /> Documentos
              </ToggleButton>
              <ToggleButton value="historial" aria-label="Ver línea de tiempo">
                <TimelineRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Historial
              </ToggleButton>
            </ToggleButtonGroup>
            <Button variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => setSubiendo(true)}>
              Subir documento
            </Button>
          </>
        }
      />
      {vista === "historial" ? contenidoHistorial() : contenidoDocumentos()}
      <DialogoSubida
        abierto={subiendo}
        controles={(controles.datos?.controles || []).filter((c) => c.estado !== "cancelado")}
        onCerrar={() => setSubiendo(false)}
        onSubido={alSubir}
      />
    </main>
  );
};

export default HistorialDocumentos;
