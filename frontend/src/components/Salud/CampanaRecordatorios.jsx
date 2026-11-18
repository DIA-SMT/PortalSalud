import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, IconButton, Tooltip } from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import useSaludStore from "../../Zustand/useSaludStore";

const INTERVALO_MS = 2 * 60 * 1000;

// Campana del header con la cantidad de recordatorios sin leer.
// Se actualiza al navegar y cada dos minutos mientras la pestaña está visible.
const CampanaRecordatorios = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const noLeidos = useSaludStore((s) => s.noLeidos);
  const actualizarNoLeidos = useSaludStore((s) => s.actualizarNoLeidos);

  useEffect(() => {
    actualizarNoLeidos();
  }, [pathname, actualizarNoLeidos]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") actualizarNoLeidos();
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [actualizarNoLeidos]);

  const etiqueta = noLeidos
    ? `Recordatorios: ${noLeidos} sin leer`
    : "Recordatorios: no hay nuevos";

  return (
    <Tooltip title={etiqueta}>
      <IconButton className="cd-nav__tema" size="small" aria-label={etiqueta} onClick={() => navigate("/salud/recordatorios")}>
        <Badge badgeContent={noLeidos} color="primary" max={9}>
          <NotificationsNoneRoundedIcon fontSize="small" />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default CampanaRecordatorios;
