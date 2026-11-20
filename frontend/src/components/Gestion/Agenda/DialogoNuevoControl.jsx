/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
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
import { hoyISO } from "../../../helpers/fechas";

const VACIO = { empleado: null, tipo: "", fechaProgramada: "", lugar: "", responsable: "" };

// Alta de un control para un empleado del padrón (dentro del ámbito de quien lo carga).
const DialogoNuevoControl = ({ abierto, tiposSugeridos = [], onCerrar, onCreado }) => {
  const tema = useTheme();
  const pantallaChica = useMediaQuery(tema.breakpoints.down("sm"));
  const [valores, setValores] = useState(VACIO);
  const [opciones, setOpciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setValores(VACIO);
      setErrores({});
      setErrorServidor("");
      setBusqueda("");
    }
  }, [abierto]);

  // Búsqueda de empleados en el padrón con una pequeña espera.
  useEffect(() => {
    if (!abierto) return undefined;
    const id = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await axiosSalud.get(`/gestion/agenda/empleados?buscar=${encodeURIComponent(busqueda.trim())}`);
        setOpciones(data.empleados.filter((e) => e.activo));
      } catch {
        setOpciones([]);
      }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(id);
  }, [busqueda, abierto]);

  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    const nuevos = {
      empleado: valores.empleado ? "" : "Elegí un empleado",
      tipo: valores.tipo.trim().length >= 3 ? "" : "Indicá el tipo de control",
      fechaProgramada: valores.fechaProgramada && valores.fechaProgramada < hoyISO() ? "No puede ser anterior a hoy" : "",
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setGuardando(true);
    setErrorServidor("");
    try {
      await axiosSalud.post("/gestion/agenda", {
        legajo: valores.empleado.legajo,
        tipo: valores.tipo.trim(),
        fechaProgramada: valores.fechaProgramada || undefined,
        lugar: valores.lugar,
        responsable: valores.responsable,
      });
      onCreado();
    } catch (error) {
      setErrorServidor(mensajeDeError(error));
    }
    setGuardando(false);
  };

  return (
    <Dialog open={abierto} onClose={guardando ? undefined : onCerrar} fullScreen={pantallaChica} fullWidth maxWidth="sm">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>Nuevo control</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {errorServidor && <Alert severity="error">{errorServidor}</Alert>}
            <Autocomplete
              options={opciones}
              loading={buscando}
              value={valores.empleado}
              onChange={(_e, empleado) => setValores((v) => ({ ...v, empleado }))}
              onInputChange={(_e, texto, motivo) => motivo === "input" && setBusqueda(texto)}
              filterOptions={(x) => x}
              getOptionLabel={(e) => `${e.apellido}, ${e.nombre} · Legajo ${e.legajo}`}
              isOptionEqualToValue={(a, b) => a.legajo === b.legajo}
              noOptionsText={busqueda ? "Sin resultados en tu ámbito" : "Escribí apellido, nombre o legajo"}
              renderOption={(props, e) => (
                <li {...props} key={e.legajo}>
                  <span className="ps-lista__textos">
                    <span className="ps-lista__principal">
                      {e.apellido}, {e.nombre}
                    </span>
                    <span className="ps-lista__secundario">
                      Legajo {e.legajo} · {e.reparticion || "Sin repartición"}
                      {e.ingresoAlPortal ? "" : " · aún no ingresó al portal"}
                    </span>
                  </span>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Empleado" required error={Boolean(errores.empleado)} helperText={errores.empleado} autoFocus />
              )}
            />
            <Autocomplete
              freeSolo
              options={tiposSugeridos}
              inputValue={valores.tipo}
              onInputChange={(_e, tipo) => setValores((v) => ({ ...v, tipo }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tipo de control"
                  required
                  error={Boolean(errores.tipo)}
                  helperText={errores.tipo || "Dato administrativo: no incluyas diagnósticos."}
                  inputProps={{ ...params.inputProps, maxLength: 80 }}
                />
              )}
            />
            <TextField
              label="Fecha (opcional)"
              type="date"
              value={valores.fechaProgramada}
              onChange={cambiar("fechaProgramada")}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: hoyISO() }}
              error={Boolean(errores.fechaProgramada)}
              helperText={errores.fechaProgramada || "Sin fecha, el control queda pendiente de coordinar."}
            />
            <TextField label="Lugar" value={valores.lugar} onChange={cambiar("lugar")} inputProps={{ maxLength: 160 }} />
            <TextField label="Profesional o institución responsable" value={valores.responsable} onChange={cambiar("responsable")} inputProps={{ maxLength: 160 }} />
            <Alert severity="info" variant="outlined">
              El empleado recibe un aviso en el portal con el tipo, la fecha y el lugar.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={guardando}>
            {guardando ? "Guardando…" : "Programar"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DialogoNuevoControl;
