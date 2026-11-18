import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import useCarga from "../../../hooks/useCarga";
import { BloqueFicha, CargandoBloques, ErrorCarga } from "./Comunes";
import ListaDocumentos from "../Documentos/ListaDocumentos";

// Resumen de la documentación dentro de la ficha. La gestión completa
// (subir, retirar, historial) está en "Historial y documentos".
const TabDocumentos = () => {
  const navigate = useNavigate();
  const { datos, cargando, error, recargar } = useCarga("/salud/documentos");

  if (cargando) return <CargandoBloques />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;

  return (
    <BloqueFicha
      id="b-documentos"
      titulo="Documentación"
      descripcion="Estudios, certificados, informes y constancias asociados a tu ficha."
      acciones={
        <Button variant="outlined" endIcon={<ChevronRightRoundedIcon />} onClick={() => navigate("/salud/documentos")}>
          Subir o gestionar
        </Button>
      }
    >
      {datos.documentos.length === 0 ? (
        <p className="ps-tarjeta__vacio">Todavía no hay documentos en tu ficha.</p>
      ) : (
        <ListaDocumentos documentos={datos.documentos} />
      )}
    </BloqueFicha>
  );
};

export default TabDocumentos;
