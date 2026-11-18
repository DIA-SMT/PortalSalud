/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Button, FormControlLabel, Switch, ToggleButton, ToggleButtonGroup } from "@mui/material";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { avisarError, avisarExito } from "../../../helpers/avisos";
import { BloqueFicha } from "../Ficha/Comunes";

const textoDias = (d) => (d === 1 ? "1 día" : `${d} días`);

// Anticipación de los avisos y canales. Los canales externos (correo, WhatsApp)
// quedan visibles pero deshabilitados hasta que exista el servicio y el consentimiento.
const PreferenciasNotificacion = ({ preferencias, onGuardadas }) => {
  const [dias, setDias] = useState(preferencias.diasAnticipacion);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setDias(preferencias.diasAnticipacion), [preferencias.diasAnticipacion]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const { data } = await axiosSalud.put("/salud/preferencias", { diasAnticipacion: dias });
      onGuardadas(data);
      avisarExito("Preferencias guardadas");
    } catch (error) {
      avisarError(mensajeDeError(error));
    }
    setGuardando(false);
  };

  const sinCambios = preferencias.configurado && dias === preferencias.diasAnticipacion;

  return (
    <BloqueFicha
      id="preferencias"
      titulo="Preferencias de recordatorios"
      descripcion="Elegí con cuánta anticipación querés que te avisemos de tus controles."
    >
      <div>
        <p className="ps-dato__titulo" id="etq-anticipacion">
          Avisarme antes de cada control
        </p>
        <ToggleButtonGroup
          value={dias}
          exclusive
          size="small"
          onChange={(_e, valor) => valor && setDias(valor)}
          aria-labelledby="etq-anticipacion"
          sx={{ flexWrap: "wrap" }}
        >
          {preferencias.opcionesDias.map((d) => (
            <ToggleButton key={d} value={d}>
              {textoDias(d)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      <div className="ps-canales">
        <p className="ps-dato__titulo">Dónde recibir los avisos</p>
        <FormControlLabel control={<Switch checked disabled />} label="Dentro del portal (siempre activo)" />
        <FormControlLabel
          control={<Switch checked={preferencias.canalEmail} disabled={!preferencias.canalesDisponibles.email} />}
          label={preferencias.canalesDisponibles.email ? "Correo electrónico" : "Correo electrónico · próximamente"}
        />
        <FormControlLabel
          control={<Switch checked={preferencias.canalWhatsapp} disabled={!preferencias.canalesDisponibles.whatsapp} />}
          label={preferencias.canalesDisponibles.whatsapp ? "WhatsApp" : "WhatsApp · próximamente"}
        />
        <p className="ps-bloque__descripcion">
          Los avisos fuera del portal se activan solo con tu consentimiento y nunca incluyen información médica.
        </p>
      </div>

      <Button variant="contained" className="align-self-start" onClick={guardar} disabled={guardando || sinCambios}>
        {guardando ? "Guardando…" : "Guardar preferencias"}
      </Button>
    </BloqueFicha>
  );
};

export default PreferenciasNotificacion;
