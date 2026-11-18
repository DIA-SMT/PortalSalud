/* eslint-disable react/prop-types */
import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Skeleton } from "@mui/material";
import Layout from "./common/Layout";
import LimiteErrores from "./common/LimiteErrores";
import MiSalud from "./pages/Salud/MiSalud";
import FichaSalud from "./pages/Salud/FichaSalud";
import MisControles from "./pages/Salud/MisControles";
import Recordatorios from "./pages/Salud/Recordatorios";
import HistorialDocumentos from "./pages/Salud/HistorialDocumentos";
import Correcciones from "./pages/Gestion/Correcciones";
import Padron from "./pages/Gestion/Padron";
import SinSesion from "./pages/Ingreso/SinSesion";
import useSaludStore from "./Zustand/useSaludStore";

// La pantalla de ingreso simulado solo existe en desarrollo: en el build de
// producción esta rama se elimina por completo.
const IngresoDesarrollo = import.meta.env.DEV ? lazy(() => import("./pages/Ingreso/IngresoDesarrollo")) : null;

const CargandoPagina = () => (
  <main className="ps-pagina" aria-busy="true">
    <Skeleton variant="text" width={220} height={56} sx={{ mt: 3 }} />
    <Skeleton variant="rectangular" height={300} sx={{ borderRadius: "var(--cd-radio-lg)" }} />
  </main>
);

const Contenido = () => {
  const { autenticado, cargandoSesion } = useSaludStore();

  if (cargandoSesion) return <CargandoPagina />;

  if (!autenticado) {
    return IngresoDesarrollo ? (
      <Suspense fallback={<CargandoPagina />}>
        <IngresoDesarrollo />
      </Suspense>
    ) : (
      <SinSesion />
    );
  }

  // Rutas bajo /salud para poder montarlas tal cual dentro del derivador más adelante.
  return (
    <Routes>
      <Route path="/salud" element={<MiSalud />} />
      <Route path="/salud/ficha" element={<FichaSalud />} />
      <Route path="/salud/controles" element={<MisControles />} />
      <Route path="/salud/recordatorios" element={<Recordatorios />} />
      <Route path="/salud/documentos" element={<HistorialDocumentos />} />
      <Route path="/salud/gestion/correcciones" element={<Correcciones />} />
      <Route path="/salud/gestion/padron" element={<Padron />} />
      <Route path="*" element={<Navigate to="/salud" replace />} />
    </Routes>
  );
};

const App = ({ tokenIngreso }) => {
  const iniciarSesion = useSaludStore((s) => s.iniciarSesion);
  const obtenerSesion = useSaludStore((s) => s.obtenerSesion);

  useEffect(() => {
    if (tokenIngreso) iniciarSesion(tokenIngreso);
    else obtenerSesion();
  }, [tokenIngreso, iniciarSesion, obtenerSesion]);

  return (
    <HashRouter>
      <Layout>
        <LimiteErrores>
          <Contenido />
        </LimiteErrores>
      </Layout>
    </HashRouter>
  );
};

export default App;
