/* eslint-disable react/prop-types */
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EstadoControlChip from "../EstadoControlChip";
import { DatoFicha, ValidacionChip } from "../Ficha/Comunes";
import Reprogramacion from "./Reprogramacion";
import { formatearFecha } from "../../../helpers/fechas";

// Detalle de un control: solo datos administrativos de la agenda.
const DialogoControl = ({ control, onCerrar, onActualizado }) => {
  const tema = useTheme();
  const pantallaChica = useMediaQuery(tema.breakpoints.down("sm"));

  return (
    <Dialog open={Boolean(control)} onClose={onCerrar} fullScreen={pantallaChica} fullWidth maxWidth="sm">
      {control && (
        <>
          <DialogTitle sx={{ pr: 3 }}>
            {control.tipo}
            <div className="mt-2">
              <EstadoControlChip estado={control.estado} />
            </div>
          </DialogTitle>
          <DialogContent>
            <dl className="ps-datos mb-3">
              <DatoFicha etiqueta="Fecha programada" valor={control.fechaProgramada && formatearFecha(control.fechaProgramada)} vacio="Sin fecha asignada" />
              <DatoFicha etiqueta="Fecha de realización" valor={control.fechaRealizacion && formatearFecha(control.fechaRealizacion)} vacio="—" />
              <DatoFicha etiqueta="Lugar" valor={control.lugar} vacio="A confirmar" />
              <DatoFicha etiqueta="Responsable" valor={control.responsable} vacio="A confirmar" />
              {control.proximaRevision && (
                <DatoFicha etiqueta="Próxima revisión" valor={formatearFecha(control.proximaRevision)} />
              )}
            </dl>

            <h3 className="ps-tarjeta__titulo mb-2">Documentación asociada</h3>
            {control.documentos.length === 0 ? (
              <p className="ps-tarjeta__vacio mb-3">No hay documentos asociados a este control.</p>
            ) : (
              <ul className="ps-lista mb-3">
                {control.documentos.map((d) => (
                  <li className="ps-lista__item" key={d.id}>
                    <span className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <DescriptionOutlinedIcon sx={{ color: "var(--cd-text-3)" }} aria-hidden="true" />
                      <span className="ps-lista__principal">{d.titulo}</span>
                    </span>
                    <ValidacionChip estado={d.estadoValidacion} />
                  </li>
                ))}
              </ul>
            )}

            <Reprogramacion control={control} onActualizado={onActualizado} />
          </DialogContent>
          <DialogActions>
            <Button onClick={onCerrar} variant="contained">
              Cerrar
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default DialogoControl;
