import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// El orden importa: reset propio -> Bootstrap -> tokens Ciudad Digital (pisan a Bootstrap) -> propios del portal.
import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/ciudadDigital.css";
import "./styles/salud.css";
import ProveedorTema from "./theme/ProveedorTema.jsx";
import { extraerTokenIngreso } from "./helpers/tokenIngreso";

// Se saca el token de CiDiTuc de la URL antes del primer render.
const tokenIngreso = extraerTokenIngreso();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ProveedorTema>
    <App tokenIngreso={tokenIngreso} />
  </ProveedorTema>
);
