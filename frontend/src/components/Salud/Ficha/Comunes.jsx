/* eslint-disable react/prop-types */
import { Alert, Button, Chip, Skeleton } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

// Bloque de contenido de una pestaña de la ficha.
export const BloqueFicha = ({ titulo, descripcion, acciones, children, id }) => (
  <section className="cd-superficie ps-tarjeta" aria-labelledby={id}>
    <div className="ps-bloque__cabecera">
      <div>
        <h2 className="ps-tarjeta__titulo" id={id}>
          {titulo}
        </h2>
        {descripcion && <p className="ps-bloque__descripcion">{descripcion}</p>}
      </div>
      {acciones && <div className="ps-bloque__acciones">{acciones}</div>}
    </div>
    {children}
  </section>
);

// Par etiqueta / valor de solo lectura.
export const DatoFicha = ({ etiqueta, valor, vacio = "Sin datos" }) => (
  <div className="ps-dato">
    <dt>{etiqueta}</dt>
    <dd className={valor ? "" : "ps-dato--vacio"}>{valor || vacio}</dd>
  </div>
);

const ESTADOS_DATO = {
  capital_humano: { texto: "Cargado por Capital Humano", bg: "var(--cd-azul-bg)", color: "var(--cd-accent-fuerte)" },
  servicio_salud: { texto: "Registrado por el servicio de salud", bg: "var(--cd-azul-bg)", color: "var(--cd-accent-fuerte)" },
  portal_empleado: { texto: "Dato del Portal del Empleado", bg: "var(--cd-azul-bg)", color: "var(--cd-accent-fuerte)" },
  cidituc: { texto: "Dato de Ciudad Digital", bg: "var(--cd-azul-bg)", color: "var(--cd-accent-fuerte)" },
  empleado: { texto: "Cargado por vos", bg: "var(--cd-hover)", color: "var(--cd-text-2)" },
  pendiente_revision: { texto: "Modificado por vos · pendiente de revisión", bg: "var(--cd-amarillo-bg)", color: "var(--cd-text)" },
  revisado: { texto: "Revisado", bg: "var(--cd-verde-bg)", color: "var(--cd-text)" },
};

// Quién cargó el dato y si hay una corrección del empleado esperando revisión.
export const EstadoDatoChip = ({ estado }) => {
  const e = ESTADOS_DATO[estado];
  if (!e) return null;
  return <Chip size="small" label={e.texto} sx={{ bgcolor: e.bg, color: e.color, flexShrink: 0, maxWidth: "100%" }} />;
};

const VALIDACION = {
  pendiente: { texto: "Pendiente de validación", bg: "var(--cd-naranja-bg)" },
  validado: { texto: "Validado", bg: "var(--cd-verde-bg)" },
  rechazado: { texto: "Rechazado", bg: "var(--cd-hover)" },
};

export const ValidacionChip = ({ estado }) => {
  const v = VALIDACION[estado] || VALIDACION.pendiente;
  return <Chip size="small" label={v.texto} sx={{ bgcolor: v.bg, color: "var(--cd-text)", flexShrink: 0 }} />;
};

export const CargandoBloques = () => (
  <div className="ps-pila" aria-busy="true" aria-label="Cargando">
    {[0, 1].map((i) => (
      <Skeleton key={i} variant="rectangular" height={160} sx={{ borderRadius: "var(--cd-radio-lg)" }} />
    ))}
  </div>
);

export const ErrorCarga = ({ error, onReintentar }) => (
  <Alert
    severity="error"
    action={
      <Button color="inherit" size="small" startIcon={<RefreshRoundedIcon />} onClick={onReintentar}>
        Reintentar
      </Button>
    }
  >
    {error}
  </Alert>
);
