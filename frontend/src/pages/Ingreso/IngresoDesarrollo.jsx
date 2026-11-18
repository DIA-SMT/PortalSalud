import { useEffect, useState } from "react";
import { Alert, Skeleton } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useSaludStore from "../../Zustand/useSaludStore";

// SOLO DESARROLLO: simula la llegada desde CiDiTuc con personas ficticias.
// No se incluye en el build de producción (ver App.jsx) y el backend rechaza
// el modo simulado en producción.
const IngresoDesarrollo = () => {
  const iniciarSesion = useSaludStore((s) => s.iniciarSesion);
  const errorSesion = useSaludStore((s) => s.errorSesion);
  const [personas, setPersonas] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axiosSalud
      .get("/sesion/simulado/personas")
      .then(({ data }) => setPersonas(data.personas))
      .catch((e) => setError(mensajeDeError(e)));
  }, []);

  return (
    <main className="ps-pagina" style={{ maxWidth: 640 }}>
      <header className="cd-encabezado">
        <div className="cd-encabezado__izquierda">
          <span className="cd-encabezado__sup">Entorno de desarrollo</span>
          <h1 className="cd-encabezado__titulo">Ingreso simulado</h1>
          <p className="cd-encabezado__sub">
            Elegí una persona ficticia. En producción se ingresa únicamente desde Ciudad Digital.
          </p>
        </div>
      </header>

      {(error || errorSesion) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error || errorSesion}
        </Alert>
      )}

      {!personas && !error && <Skeleton variant="rectangular" height={300} sx={{ borderRadius: "var(--cd-radio-lg)" }} />}

      {personas && (
        <ul className="cd-superficie ps-lista" style={{ padding: 8 }}>
          {personas.map((p) => (
            <li key={p.token} className="ps-lista__item" style={{ padding: 0 }}>
              <button
                type="button"
                className="cd-drawer__item w-100 d-flex align-items-center justify-content-between border-0 bg-transparent text-start"
                onClick={() => iniciarSesion(p.token)}
              >
                <span className="ps-lista__textos">
                  <span className="ps-lista__principal">{p.nombre}</span>
                  <span className="ps-lista__secundario">
                    {p.descripcion} · {p.reparticion}
                  </span>
                </span>
                <ChevronRightRoundedIcon aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default IngresoDesarrollo;
