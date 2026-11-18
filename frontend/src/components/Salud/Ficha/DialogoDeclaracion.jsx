/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { validarTexto } from "../../../helpers/validaciones";
import { CATEGORIAS_SALUD } from "./categorias";

// Alta o corrección de un dato de salud por el empleado (Capital Humano lo revisa después).
const DialogoDeclaracion = ({ abierto, categoria, declaracion, onCerrar, onGuardado }) => {
  const tema = useTheme();
  const pantallaChica = useMediaQuery(tema.breakpoints.down("sm"));
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState("");
  const [errorServidor, setErrorServidor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const info = CATEGORIAS_SALUD[categoria] || {};

  useEffect(() => {
    if (abierto) {
      setDescripcion(declaracion?.descripcion || "");
      setError("");
      setErrorServidor("");
    }
  }, [abierto, declaracion]);

  const guardar = async (e) => {
    e.preventDefault();
    const err = validarTexto(descripcion, { max: 500, etiqueta: "Descripción" });
    setError(err);
    if (err) return;
    setGuardando(true);
    setErrorServidor("");
    try {
      const { data } = declaracion
        ? await axiosSalud.put(`/salud/ficha/salud/declaraciones/${declaracion.id}`, { descripcion })
        : await axiosSalud.post("/salud/ficha/salud/declaraciones", { categoria, descripcion });
      onGuardado(data);
    } catch (error) {
      setErrorServidor(mensajeDeError(error));
    }
    setGuardando(false);
  };

  return (
    <Dialog open={abierto} onClose={guardando ? undefined : onCerrar} fullScreen={pantallaChica} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{declaracion ? `Corregir ${info.singular}` : `Agregar ${info.singular}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {errorServidor && <Alert severity="error">{errorServidor}</Alert>}
            <TextField
              label="Descripción"
              placeholder={info.ejemplo}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              error={Boolean(error)}
              helperText={error || `${descripcion.length}/500`}
              multiline
              minRows={3}
              required
              autoFocus
              inputProps={{ maxLength: 500 }}
            />
            <Alert severity="info" variant="outlined">
              El cambio se aplica enseguida y Capital Humano lo va a <strong>revisar</strong>.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DialogoDeclaracion;
