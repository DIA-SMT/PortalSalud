import { Outlet } from "react-router-dom";
import NavBar from "./NavBar";
import CampanaRecordatorios from "../components/Salud/CampanaRecordatorios";
import useSaludStore from "../Zustand/useSaludStore";

// Conecta el NavBar de la plantilla ux-ui con la sesión del portal.
// eslint-disable-next-line react/prop-types
const Layout = ({ children }) => {
  const { autenticado, cargandoSesion, usuario, roles, cerrarSesion } = useSaludStore();

  return (
    <>
      <NavBar
        autenticado={autenticado}
        cargando={cargandoSesion}
        nombreUsuario={usuario ? `${usuario.nombre} ${usuario.apellido}` : ""}
        sesion={{ usuario, roles }}
        onCerrarSesion={cerrarSesion}
        accionesExtra={autenticado ? <CampanaRecordatorios /> : null}
      />
      {children ?? <Outlet />}
    </>
  );
};

export default Layout;
