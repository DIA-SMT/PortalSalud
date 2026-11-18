/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { TIPOS_DOCUMENTO, formatearTamano, validarArchivoLocal } from "../../../helpers/documentos";
import { validarTexto } from "../../../helpers/validaciones";
import { formatearFecha } from "../../../helpers/fechas";

const VACIO = { tipo: "constancia", titulo: "", idControl: "" };

// Subida de un documento propio. Queda "pendiente de validación" hasta que lo revise el servicio.
const DialogoSubida = ({ abierto, controles = [], onCerrar, onSubido }) => {
  const tema = useTheme();
  const pantallaChica = useMediaQuery(tema.breakpoints.down("sm"));
  const entrada = useRef(null);
  const [valores, setValores] = useState(VACIO);
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [progreso, setProgreso] = useState(null);

  useEffect(() => {
    if (abierto) {
      setValores(VACIO);
      setArchivo(null);
      setErrores({});
      setErrorServidor("");
      setProgreso(null);
    }
  }, [abierto]);

  const tipo = TIPOS_DOCUMENTO[valores.tipo];
  const esClinico = tipo.clasificacion === "clinico";
  const enviando = progreso !== null;

  const elegirArchivo = (e) => {
    const elegido = e.target.files?.[0] || null;
    setArchivo(elegido);
    setErrores((x) => ({ ...x, archivo: elegido ? validarArchivoLocal(elegido) : "" }));
    if (elegido && !valores.titulo) {
      setValores((v) => ({ ...v, titulo: elegido.name.replace(/\.[^.]+$/, "").slice(0, 160) }));
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    const nuevos = {
      archivo: validarArchivoLocal(archivo),
      titulo: validarTexto(valores.titulo, { min: 3, max: 160, etiqueta: "Título" }),
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;

    const datos = new FormData();
    datos.append("tipo", valores.tipo);
    datos.append("titulo", valores.titulo.trim());
    if (!esClinico && valores.idControl) datos.append("idControl", valores.idControl);
    datos.append("archivo", archivo);

    setErrorServidor("");
    setProgreso(0);
    try {
      const { data } = await axiosSalud.post("/salud/documentos", datos, {
        onUploadProgress: (ev) => ev.total && setProgreso(Math.round((ev.loaded / ev.total) * 100)),
      });
      onSubido(data);
    } catch (error) {
      setErrorServidor(mensajeDeError(error));
    }
    setProgreso(null);
  };

  return (
    <Dialog open={abierto} onClose={enviando ? undefined : onCerrar} fullScreen={pantallaChica} fullWidth maxWidth="sm">
      <form onSubmit={enviar} noValidate>
        <DialogTitle>Subir documento</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {errorServidor && <Alert severity="error">{errorServidor}</Alert>}

            <TextField
              select
              label="Tipo de documento"
              value={valores.tipo}
              onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value }))}
              helperText={tipo.ayuda}
            >
              {Object.entries(TIPOS_DOCUMENTO).map(([clave, t]) => (
                <MenuItem key={clave} value={clave}>
                  {t.texto}
                </MenuItem>
              ))}
            </TextField>

            {esClinico && (
              <Alert severity="info" icon={<LockOutlinedIcon fontSize="inherit" />}>
                Se guarda como información confidencial: solo la ven vos y el personal de salud autorizado.
              </Alert>
            )}

            <div>
              <input
                ref={entrada}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={elegirArchivo}
                className="visually-hidden"
                id="archivo-documento"
                aria-describedby="ayuda-archivo"
              />
              <Button variant="outlined" startIcon={<AttachFileRoundedIcon />} onClick={() => entrada.current?.click()}>
                {archivo ? "Cambiar archivo" : "Elegir archivo"}
              </Button>
              <p className={`ps-bloque__descripcion${errores.archivo ? " ps-error" : ""}`} id="ayuda-archivo" role={errores.archivo ? "alert" : undefined}>
                {errores.archivo ||
                  (archivo ? `${archivo.name} · ${formatearTamano(archivo.size)}` : "PDF, JPG o PNG de hasta 5 MB.")}
              </p>
            </div>

            <TextField
              label="Título"
              value={valores.titulo}
              onChange={(e) => setValores((v) => ({ ...v, titulo: e.target.value }))}
              error={Boolean(errores.titulo)}
              helperText={errores.titulo || "Un nombre que te ayude a reconocerlo."}
              required
              inputProps={{ maxLength: 160 }}
            />

            {!esClinico && controles.length > 0 && (
              <TextField
                select
                label="Control asociado (opcional)"
                value={valores.idControl}
                onChange={(e) => setValores((v) => ({ ...v, idControl: e.target.value }))}
              >
                <MenuItem value="">Ninguno</MenuItem>
                {controles.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.tipo} · {c.fechaProgramada ? formatearFecha(c.fechaProgramada) : "sin fecha"}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {enviando && <LinearProgress variant="determinate" value={progreso} aria-label="Progreso de la subida" />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={enviando}>
            {enviando ? "Subiendo…" : "Subir"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DialogoSubida;
