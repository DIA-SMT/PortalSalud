import { Button } from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import isotipo from "../../assets/logoMuni-sm.png";
import useSaludStore from "../../Zustand/useSaludStore";

const URL_CIUDAD_DIGITAL = import.meta.env.VITE_APP_URL_CIUDAD_DIGITAL || "https://ciudaddigital.smt.gob.ar/";

// El portal no tiene login propio: se ingresa desde Ciudad Digital.
const SinSesion = () => {
  const errorSesion = useSaludStore((s) => s.errorSesion);

  return (
    <main className="cd-superficie ps-estado">
      <img src={isotipo} alt="Municipalidad de San Miguel de Tucumán" />
      <h1 className="ps-estado__titulo">Ingresá desde Ciudad Digital</h1>
      <p className="ps-estado__texto">
        {errorSesion || "Tu sesión no está activa. Para ver tu información de salud, ingresá a Ciudad Digital y abrí Mi Salud."}
      </p>
      <Button variant="contained" href={URL_CIUDAD_DIGITAL} endIcon={<OpenInNewRoundedIcon />}>
        Ir a Ciudad Digital
      </Button>
    </main>
  );
};

export default SinSesion;
