/* eslint-disable react/prop-types */
import { Chip } from "@mui/material";
import { ESTADOS_CONTROL } from "../../helpers/estadosControl";

const EstadoControlChip = ({ estado }) => {
  const estilo = ESTADOS_CONTROL[estado] || ESTADOS_CONTROL.pendiente;
  return (
    <Chip
      size="small"
      label={estilo.texto}
      sx={{ bgcolor: estilo.bg, color: estilo.color, flexShrink: 0 }}
    />
  );
};

export default EstadoControlChip;
