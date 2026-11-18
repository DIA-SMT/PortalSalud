/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@mui/material";

// Confirmación para revertir una corrección, con nota opcional (no se envía al empleado).
const DialogoReversion = ({ correccion, onCerrar, onConfirmar }) => {
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (correccion) setNota("");
  }, [correccion]);

  const confirmar = async () => {
    setEnviando(true);
    await onConfirmar(nota);
    setEnviando(false);
  };

  return (
    <Dialog open={Boolean(correccion)} onClose={enviando ? undefined : onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>¿Restaurar el dato anterior?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {correccion?.persona.nombre} va a recibir un aviso en el portal indicando que se restauró un dato de su ficha
          (sin el detalle).
        </DialogContentText>
        <TextField
          label="Nota interna (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          helperText="Queda registrada en la revisión. No incluyas información médica innecesaria."
          inputProps={{ maxLength: 300 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="contained" color="error" onClick={confirmar} disabled={enviando}>
          {enviando ? "Restaurando…" : "Restaurar dato anterior"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DialogoReversion;
