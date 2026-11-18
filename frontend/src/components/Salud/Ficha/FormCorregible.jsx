/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Button, MenuItem, TextField } from "@mui/material";
import { mensajeDeError } from "../../../config/axiosSalud";
import Swal from "../../../common/alerta";
import { avisarError, avisarExito } from "../../../helpers/avisos";
import { EstadoDatoChip } from "./Comunes";

// Datos que no cargó el propio empleado: corregirlos pide confirmación.
const CARGADO_POR_AREA = ["capital_humano", "servicio_salud", "portal_empleado", "cidituc", "revisado"];

const valoresIniciales = (campos, datos) =>
  Object.fromEntries(campos.map((c) => [c.clave, datos[c.clave]?.valor ?? ""]));

// Formulario de datos que carga el área responsable y que el empleado puede corregir.
// Cada campo muestra quién lo cargó o si está pendiente de revisión. Antes de pisar
// un dato cargado por el área, se pide confirmación.
//   campos: [{ clave, etiqueta, max, tipo, opciones, validar(valor) -> mensaje }]
//   datos:  { [clave]: { valor, estado } }
//   guardar(valores) -> Promise<{ [clave]: { valor, estado } }>
const FormCorregible = ({ campos, datos, guardar, onGuardado, textoExito = "Cambios guardados" }) => {
  const iniciales = useMemo(() => valoresIniciales(campos, datos), [campos, datos]);
  const [valores, setValores] = useState(iniciales);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setValores(iniciales), [iniciales]);

  const modificados = campos.filter((c) => (valores[c.clave] || "").trim() !== (iniciales[c.clave] || "").trim());

  const enviar = async (e) => {
    e.preventDefault();
    const nuevos = Object.fromEntries(campos.map((c) => [c.clave, c.validar ? c.validar(valores[c.clave]) : ""]));
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean) || !modificados.length) return;

    if (modificados.some((c) => CARGADO_POR_AREA.includes(datos[c.clave]?.estado))) {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: "¿Corregir datos cargados por el área?",
        text: "El cambio se aplica ahora y Capital Humano lo va a revisar. Si no corresponde, pueden restaurar el dato anterior.",
        showCancelButton: true,
        confirmButtonText: "Sí, corregir",
        cancelButtonText: "Cancelar",
        cancelButtonColor: "var(--cd-text-3)",
        focusCancel: true,
      });
      if (!isConfirmed) return;
    }

    setGuardando(true);
    try {
      const cuerpo = Object.fromEntries(modificados.map((c) => [c.clave, valores[c.clave]]));
      onGuardado(await guardar(cuerpo));
      avisarExito(textoExito);
    } catch (error) {
      avisarError(mensajeDeError(error));
    }
    setGuardando(false);
  };

  return (
    <form onSubmit={enviar} noValidate className="ps-form-corregible">
      <div className="ps-campos">
        {campos.map((c) => (
          <div key={c.clave} className={c.ancho === "completo" ? "ps-campo ps-campo--completo" : "ps-campo"}>
            <TextField
              select={Boolean(c.opciones)}
              label={c.etiqueta}
              type={c.tipo || "text"}
              size="small"
              fullWidth
              value={valores[c.clave] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
              error={Boolean(errores[c.clave])}
              helperText={errores[c.clave] || undefined}
              inputProps={{ maxLength: c.max }}
            >
              {c.opciones?.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </TextField>
            <div className="ps-campo__estado">
              <EstadoDatoChip estado={datos[c.clave]?.estado} />
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" variant="contained" className="align-self-start" disabled={guardando || !modificados.length}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
};


export default FormCorregible;
