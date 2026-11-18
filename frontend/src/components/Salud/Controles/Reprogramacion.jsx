/* eslint-disable react/prop-types */
import { useState } from "react";
import { Alert, Button, Stack, TextField } from "@mui/material";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { avisarExito } from "../../../helpers/avisos";
import { validarTexto } from "../../../helpers/validaciones";

const ESTADOS = {
  pendiente: { severidad: "info", texto: "Pediste otra fecha. El servicio de salud te va a responder." },
  aceptada: { severidad: "success", texto: "El servicio de salud aceptó tu pedido de reprogramación." },
  rechazada: {
    severidad: "warning",
    texto: "El servicio de salud no pudo reprogramar este control. Si lo necesitás, comunicate con el servicio.",
  },
};

// Pedido de otra fecha para un control agendado. Lo resuelve el servicio de salud.
const Reprogramacion = ({ control, onActualizado }) => {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const solicitud = control.solicitudReprogramacion;

  const enviar = async (e) => {
    e.preventDefault();
    const err = validarTexto(motivo, { min: 5, max: 300, etiqueta: "Motivo" });
    setError(err);
    if (err) return;
    setEnviando(true);
    try {
      const { data } = await axiosSalud.post(`/salud/controles/${control.id}/reprogramacion`, { motivo });
      onActualizado(data);
      setAbierto(false);
      setMotivo("");
      avisarExito("Pedido enviado");
    } catch (e2) {
      setError(mensajeDeError(e2));
    }
    setEnviando(false);
  };

  if (solicitud && (solicitud.estado === "pendiente" || !control.puedeSolicitarReprogramacion)) {
    const info = ESTADOS[solicitud.estado] || ESTADOS.pendiente;
    return <Alert severity={info.severidad}>{info.texto}</Alert>;
  }

  if (!control.puedeSolicitarReprogramacion) {
    return ["programado", "reprogramado", "pendiente", "vencido"].includes(control.estado) ? (
      <Alert severity="info" variant="outlined">
        Si necesitás cambiar la fecha, comunicate con el servicio de salud laboral.
      </Alert>
    ) : null;
  }

  if (!abierto) {
    return (
      <Button variant="outlined" startIcon={<EventRepeatRoundedIcon />} onClick={() => setAbierto(true)}>
        Pedir otra fecha
      </Button>
    );
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Stack spacing={1.5}>
        <TextField
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          error={Boolean(error)}
          helperText={error || "Por ejemplo: licencia, viaje, capacitación. No incluyas información médica."}
          multiline
          minRows={2}
          required
          autoFocus
          inputProps={{ maxLength: 300 }}
        />
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar pedido"}
          </Button>
          <Button onClick={() => setAbierto(false)} disabled={enviando}>
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </form>
  );
};

export default Reprogramacion;
