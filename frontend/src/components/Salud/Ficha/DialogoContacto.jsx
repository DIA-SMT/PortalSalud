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
import { validarTelefono, validarTexto } from "../../../helpers/validaciones";

const VACIO = { nombre: "", vinculo: "", telefono: "", telefonoAlternativo: "" };

// Alta o edición de un contacto de emergencia.
const DialogoContacto = ({ abierto, contacto, onCerrar, onGuardado }) => {
  const tema = useTheme();
  const pantallaChica = useMediaQuery(tema.breakpoints.down("sm"));
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setValores(contacto ? { ...VACIO, ...contacto, telefonoAlternativo: contacto.telefonoAlternativo || "" } : VACIO);
      setErrores({});
      setErrorServidor("");
    }
  }, [abierto, contacto]);

  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

  const validar = () => {
    const nuevos = {
      nombre: validarTexto(valores.nombre, { max: 120, etiqueta: "Nombre" }),
      vinculo: validarTexto(valores.vinculo, { max: 60, etiqueta: "Vínculo" }),
      telefono: validarTelefono(valores.telefono, { requerido: true }),
      telefonoAlternativo: validarTelefono(valores.telefonoAlternativo),
    };
    setErrores(nuevos);
    return Object.values(nuevos).every((e) => !e);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    setErrorServidor("");
    const cuerpo = {
      nombre: valores.nombre,
      vinculo: valores.vinculo,
      telefono: valores.telefono,
      telefonoAlternativo: valores.telefonoAlternativo,
    };
    try {
      const { data } = contacto
        ? await axiosSalud.put(`/salud/ficha/contactos-emergencia/${contacto.id}`, cuerpo)
        : await axiosSalud.post("/salud/ficha/contactos-emergencia", cuerpo);
      onGuardado(data);
    } catch (error) {
      setErrorServidor(mensajeDeError(error));
    }
    setGuardando(false);
  };

  return (
    <Dialog open={abierto} onClose={guardando ? undefined : onCerrar} fullScreen={pantallaChica} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{contacto ? "Editar contacto de emergencia" : "Agregar contacto de emergencia"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {errorServidor && <Alert severity="error">{errorServidor}</Alert>}
            <TextField
              label="Nombre y apellido"
              value={valores.nombre}
              onChange={cambiar("nombre")}
              error={Boolean(errores.nombre)}
              helperText={errores.nombre}
              required
              autoFocus
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Vínculo"
              placeholder="Madre, pareja, amigo…"
              value={valores.vinculo}
              onChange={cambiar("vinculo")}
              error={Boolean(errores.vinculo)}
              helperText={errores.vinculo}
              required
              inputProps={{ maxLength: 60 }}
            />
            <TextField
              label="Teléfono"
              type="tel"
              value={valores.telefono}
              onChange={cambiar("telefono")}
              error={Boolean(errores.telefono)}
              helperText={errores.telefono}
              required
              inputProps={{ maxLength: 30, inputMode: "tel" }}
            />
            <TextField
              label="Teléfono alternativo (opcional)"
              type="tel"
              value={valores.telefonoAlternativo}
              onChange={cambiar("telefonoAlternativo")}
              error={Boolean(errores.telefonoAlternativo)}
              helperText={errores.telefonoAlternativo}
              inputProps={{ maxLength: 30, inputMode: "tel" }}
            />
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

export default DialogoContacto;
