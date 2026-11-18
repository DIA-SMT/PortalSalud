import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Skeleton } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { esRevisor } from "../../helpers/roles";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";
import {
  Completitud,
  ControlesPendientes,
  Documentos,
  ProximoControl,
  Recordatorios,
  UltimosControles,
} from "../../components/Salud/TarjetasResumen";

const EsqueletoDashboard = () => (
  <div className="ps-grilla" aria-busy="true" aria-label="Cargando tu resumen">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <Skeleton
        key={i}
        variant="rectangular"
        animation="wave"
        height={180}
        className={i === 0 ? "ps-grilla__doble" : ""}
        sx={{ borderRadius: "var(--cd-radio-lg)" }}
      />
    ))}
  </div>
);

const subtituloUsuario = (usuario) =>
  [usuario?.legajo && `Legajo ${usuario.legajo}`, usuario?.reparticion].filter(Boolean).join(" · ");

const MiSalud = () => {
  const usuario = useSaludStore((s) => s.usuario);
  const revisor = useSaludStore((s) => esRevisor(s.roles));
  const pendientesRevision = useSaludStore((s) => s.pendientesRevision);
  const actualizarPendientesRevision = useSaludStore((s) => s.actualizarPendientesRevision);
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const { data } = await axiosSalud.get("/salud/mi-resumen");
      setResumen(data);
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (revisor) actualizarPendientesRevision();
  }, [revisor, actualizarPendientesRevision]);

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        sup="Mi Salud"
        titulo={`Hola, ${usuario?.nombre || ""}`}
        subtitulo={subtituloUsuario(usuario) || "Tu información de salud laboral en un solo lugar."}
      />

      {revisor && pendientesRevision > 0 && (
        <Alert
          severity="warning"
          icon={<FactCheckOutlinedIcon fontSize="inherit" />}
          sx={{ mb: 2, bgcolor: "var(--cd-amarillo-bg)", color: "var(--cd-text)" }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate("/salud/gestion/correcciones")}>
              Revisar
            </Button>
          }
        >
          {pendientesRevision === 1
            ? "Hay 1 corrección de ficha para revisar."
            : `Hay ${pendientesRevision} correcciones de fichas para revisar.`}
        </Alert>
      )}

      {cargando && <EsqueletoDashboard />}

      {!cargando && error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<RefreshRoundedIcon />} onClick={cargar}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!cargando && resumen && (
        <div className="ps-grilla">
          <ProximoControl control={resumen.proximoControl} />
          <Completitud completitud={resumen.completitud} />
          <ControlesPendientes pendientes={resumen.controlesPendientes} />
          <Recordatorios recordatorios={resumen.recordatorios} />
          <UltimosControles controles={resumen.ultimosControles} />
          <Documentos documentos={resumen.documentos} />
        </div>
      )}
    </main>
  );
};

export default MiSalud;
