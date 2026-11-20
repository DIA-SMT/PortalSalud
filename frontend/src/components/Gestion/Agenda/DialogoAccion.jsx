/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { hoyISO } from "../../../helpers/fechas";

// Acciones sobre un control o un pedido de reprogramación:
//   reprogramar | realizado | aceptar (pedido) | rechazar (pedido)
const CONFIG = {
  reprogramar: {
    titulo: "Reprogramar control",
    boton: "Reprogramar",
    url: (o) => `/gestion/agenda/${o.id}/reprogramacion`,
    aviso: "El empleado recibe un aviso con la nueva fecha.",
  },
  realizado: {
    titulo: "Registrar control realizado",
    boton: "Registrar",
    url: (o) => `/gestion/agenda/${o.id}/realizado`,
    aviso: "Solo se registra la fecha. Los resultados no se cargan en la agenda.",
  },
  aceptar: {
    titulo: "Aceptar pedido de cambio de fecha",
    boton: "Aceptar y reprogramar",
    url: (o) => `/gestion/agenda/pedidos/${o.id}/resolucion`,
    aviso: "El empleado recibe un aviso con la nueva fecha.",
  },
  rechazar: {
    titulo: "Rechazar pedido de cambio de fecha",
    boton: "Rechazar pedido",
    url: (o) => `/gestion/agenda/pedidos/${o.id}/resolucion`,
    aviso: "Se mantiene la fecha original y el empleado recibe un aviso.",
  },
};

const DialogoAccion = ({ accion, onCerrar, onHecho }) => {
  const [valores, setValores] = useState({});
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const modo = accion?.modo;
  const config = CONFIG[modo];

  useEffect(() => {
    if (!accion) return;
    setError("");
    setValores(
      accion.modo === "realizado"
        ? { fechaRealizacion: hoyISO(), proximaRevision: "" }
        : accion.modo === "reprogramar"
        ? { fechaProgramada: "", lugar: accion.objetivo.lugar || "" }
        : { nuevaFecha: "", nota: "" }
    );
  }, [accion]);

  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

  const cuerpo = () => {
    if (modo === "aceptar") return { decision: "aceptada", nuevaFecha: valores.nuevaFecha };
    if (modo === "rechazar") return { decision: "rechazada", nota: valores.nota || undefined };
    if (modo === "realizado") return { fechaRealizacion: valores.fechaRealizacion, proximaRevision: valores.proximaRevision || undefined };
    return { fechaProgramada: valores.fechaProgramada, lugar: valores.lugar };
  };

  const validar = () => {
    if (modo === "reprogramar" && !valores.fechaProgramada) return "Elegí la nueva fecha.";
    if (modo === "aceptar" && !valores.nuevaFecha) return "Elegí la nueva fecha.";
    if (modo === "realizado" && !valores.fechaRealizacion) return "Indicá la fecha de realización.";
    if (modo === "realizado" && valores.proximaRevision && valores.proximaRevision <= valores.fechaRealizacion) {
      return "La próxima revisión tiene que ser posterior a la realización.";
    }
    return "";
  };

  const enviar = async (e) => {
    e.preventDefault();
    const err = validar();
    setError(err);
    if (err) return;
    setEnviando(true);
    try {
      await axiosSalud.post(config.url(accion.objetivo), cuerpo());
      onHecho(modo);
    } catch (e2) {
      setError(mensajeDeError(e2));
    }
    setEnviando(false);
  };

  return (
    <Dialog open={Boolean(accion)} onClose={enviando ? undefined : onCerrar} fullWidth maxWidth="xs">
      {config && (
        <form onSubmit={enviar} noValidate>
          <DialogTitle>{config.titulo}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <p className="ps-lista__secundario m-0">{accion.descripcion}</p>
              {error && <Alert severity="error">{error}</Alert>}
              {modo === "reprogramar" && (
                <>
                  <TextField label="Nueva fecha" type="date" required value={valores.fechaProgramada || ""} onChange={cambiar("fechaProgramada")} InputLabelProps={{ shrink: true }} inputProps={{ min: hoyISO() }} />
                  <TextField label="Lugar" value={valores.lugar || ""} onChange={cambiar("lugar")} inputProps={{ maxLength: 160 }} />
                </>
              )}
              {modo === "realizado" && (
                <>
                  <TextField label="Fecha de realización" type="date" required value={valores.fechaRealizacion || ""} onChange={cambiar("fechaRealizacion")} InputLabelProps={{ shrink: true }} inputProps={{ max: hoyISO() }} />
                  <TextField label="Próxima revisión (opcional)" type="date" value={valores.proximaRevision || ""} onChange={cambiar("proximaRevision")} InputLabelProps={{ shrink: true }} />
                </>
              )}
              {modo === "aceptar" && (
                <TextField label="Nueva fecha" type="date" required value={valores.nuevaFecha || ""} onChange={cambiar("nuevaFecha")} InputLabelProps={{ shrink: true }} inputProps={{ min: hoyISO() }} />
              )}
              {modo === "rechazar" && (
                <TextField
                  label="Mensaje para el empleado (opcional)"
                  value={valores.nota || ""}
                  onChange={cambiar("nota")}
                  multiline
                  minRows={2}
                  helperText="Se le envía al empleado. No incluyas información médica."
                  inputProps={{ maxLength: 200 }}
                />
              )}
              <Alert severity="info" variant="outlined">
                {config.aviso}
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color={modo === "rechazar" ? "error" : "primary"} disabled={enviando}>
              {enviando ? "Guardando…" : config.boton}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
};

export default DialogoAccion;
