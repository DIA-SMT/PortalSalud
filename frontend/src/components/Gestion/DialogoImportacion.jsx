/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";

const TIPOS = { alta: "Alta", actualizacion: "Actualización" };

const Resumen = ({ r }) => (
  <div className="d-flex flex-wrap gap-2">
    <Chip label={`${r.filas} filas`} />
    <Chip label={`${r.altas} altas`} sx={{ bgcolor: "var(--cd-verde-bg)", color: "var(--cd-text)" }} />
    <Chip label={`${r.actualizaciones} actualizaciones`} sx={{ bgcolor: "var(--cd-azul-bg)", color: "var(--cd-text)" }} />
    <Chip label={`${r.sinCambios} sin cambios`} />
    {r.bajas > 0 && <Chip label={`${r.bajas} pasan a inactivos`} sx={{ bgcolor: "var(--cd-naranja-bg)", color: "var(--cd-text)" }} />}
    {r.errores > 0 && <Chip label={`${r.errores} con errores`} sx={{ bgcolor: "var(--cd-peligro-bg)", color: "var(--cd-text)" }} />}
  </div>
);

// Importación del padrón en dos pasos: primero se revisa, después se confirma.
// Sin `fuente` (o con la fuente "csv") se sube un archivo; con una fuente remota
// (Portal del Empleado, CiDiTuc) el servidor trae los datos.
const DialogoImportacion = ({ abierto, fuente = null, onCerrar, onImportado }) => {
  const remota = Boolean(fuente && fuente.id !== "csv");
  const tema = useTheme();
  const pantallaChica = useMediaQuery(tema.breakpoints.down("sm"));
  const entrada = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [padronCompleto, setPadronCompleto] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setArchivo(null);
      setPadronCompleto(false);
      setPrevia(null);
      setError("");
    }
  }, [abierto]);

  const enviar = async (confirmar) => {
    setEnviando(true);
    setError("");
    try {
      let data;
      if (remota) {
        ({ data } = await axiosSalud.post("/gestion/padron/sincronizaciones", { fuente: fuente.id, confirmar, padronCompleto }));
      } else {
        const datos = new FormData();
        datos.append("confirmar", String(confirmar));
        datos.append("padronCompleto", String(padronCompleto));
        datos.append("archivo", archivo);
        ({ data } = await axiosSalud.post("/gestion/padron/importaciones", datos));
      }
      if (confirmar) onImportado(data);
      else setPrevia(data);
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setEnviando(false);
  };

  const elegir = (e) => {
    const elegido = e.target.files?.[0] || null;
    setArchivo(elegido);
    setPrevia(null);
    setError(elegido && !/\.csv$/i.test(elegido.name) ? "Elegí un archivo .csv (en Excel: Guardar como → CSV)." : "");
  };

  const hayCambios = previa && previa.resumen.altas + previa.resumen.actualizaciones + previa.resumen.bajas > 0;

  return (
    <Dialog open={abierto} onClose={enviando ? undefined : onCerrar} fullScreen={pantallaChica} fullWidth maxWidth="md">
      <DialogTitle>{remota ? `Sincronizar desde ${fuente.nombre}` : "Importar padrón de empleados"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <p className="ps-bloque__descripcion m-0">
            {remota
              ? `Se traen los empleados desde ${fuente.nombre}. Primero vas a ver qué cambia; nada se guarda hasta que confirmes.`
              : "Subí el CSV exportado desde RRHH con las columnas de la plantilla. Primero vas a ver qué cambia; nada se guarda hasta que confirmes."}
          </p>
          {error && <Alert severity="error">{error}</Alert>}

          {!remota && (
            <div>
              <input ref={entrada} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={elegir} />
              <Button variant="outlined" startIcon={<AttachFileRoundedIcon />} onClick={() => entrada.current?.click()} disabled={enviando}>
                {archivo ? "Cambiar archivo" : "Elegir archivo CSV"}
              </Button>
              {archivo && <span className="ps-lista__secundario ms-2">{archivo.name}</span>}
            </div>
          )}

          <FormControlLabel
            control={<Checkbox checked={padronCompleto} onChange={(e) => { setPadronCompleto(e.target.checked); setPrevia(null); }} />}
            label={`Es el padrón completo: marcar como inactivos a quienes no figuren ${remota ? "en la fuente" : "en el archivo"}`}
          />

          {enviando && <LinearProgress aria-label="Procesando archivo" />}

          {previa && (
            <>
              <Resumen r={previa.resumen} />
              {previa.resumen.conDatosLaborales > 0 && (
                <p className="ps-bloque__descripcion m-0">
                  {previa.resumen.conDatosLaborales} registros traen área, puesto o actividad: se cargan en la ficha con su
                  origen, salvo los campos que el empleado corrigió y están pendientes de revisión.
                </p>
              )}
              {previa.errores.length > 0 && (
                <>
                  <Alert severity="warning">
                    Las filas con errores no se importan. Podés corregirlas en el archivo y volver a subirlo.
                  </Alert>
                  <TableContainer sx={{ maxHeight: 240 }}>
                    <Table size="small" stickyHeader aria-label="Filas con errores">
                      <TableHead>
                        <TableRow>
                          <TableCell>Línea</TableCell>
                          <TableCell>Legajo</TableCell>
                          <TableCell>Problema</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previa.errores.map((e) => (
                          <TableRow key={e.linea}>
                            <TableCell>{e.linea}</TableCell>
                            <TableCell>{e.legajo ?? "—"}</TableCell>
                            <TableCell>{e.mensaje}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
              {previa.muestra.length > 0 && (
                <TableContainer sx={{ maxHeight: 240 }}>
                  <Table size="small" stickyHeader aria-label="Cambios a aplicar">
                    <TableHead>
                      <TableRow>
                        <TableCell>Legajo</TableCell>
                        <TableCell>Empleado</TableCell>
                        <TableCell>Cambio</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previa.muestra.map((m) => (
                        <TableRow key={m.legajo}>
                          <TableCell>{m.legajo}</TableCell>
                          <TableCell>{m.nombre}</TableCell>
                          <TableCell>{TIPOS[m.tipo]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {!hayCambios && <Alert severity="info">El archivo no trae cambios respecto del padrón actual.</Alert>}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Button>
        {previa ? (
          <Button variant="contained" onClick={() => enviar(true)} disabled={enviando || !hayCambios}>
            Confirmar importación
          </Button>
        ) : (
          <Button variant="contained" onClick={() => enviar(false)} disabled={enviando || (!remota && (!archivo || Boolean(error)))}>
            {remota ? "Revisar datos" : "Revisar archivo"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DialogoImportacion;
