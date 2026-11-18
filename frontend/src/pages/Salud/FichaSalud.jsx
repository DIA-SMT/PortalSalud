import { useSearchParams } from "react-router-dom";
import { Alert, Tab, Tabs } from "@mui/material";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import useCarga from "../../hooks/useCarga";
import { CargandoBloques, ErrorCarga } from "../../components/Salud/Ficha/Comunes";
import TabPersonales from "../../components/Salud/Ficha/TabPersonales";
import TabSalud from "../../components/Salud/Ficha/TabSalud";
import TabLaboral from "../../components/Salud/Ficha/TabLaboral";
import TabDocumentos from "../../components/Salud/Ficha/TabDocumentos";

const SECCIONES_FICHA = [
  { id: "personales", texto: "Datos personales" },
  { id: "salud", texto: "Información de salud" },
  { id: "laboral", texto: "Información laboral" },
  { id: "documentos", texto: "Documentación" },
];

const FichaSalud = () => {
  const [params, setParams] = useSearchParams();
  const seccion = SECCIONES_FICHA.some((s) => s.id === params.get("seccion")) ? params.get("seccion") : "personales";
  // Datos administrativos: se cargan una vez y los comparten las pestañas personales y laboral.
  const { datos: ficha, setDatos: setFicha, cargando, error, recargar } = useCarga("/salud/ficha");

  const contenido = () => {
    // Las pestañas clínicas cargan sus datos recién cuando se abren.
    if (seccion === "salud") return <TabSalud />;
    if (seccion === "documentos") return <TabDocumentos />;
    if (cargando) return <CargandoBloques />;
    if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
    return seccion === "laboral" ? (
      <TabLaboral
        laboral={ficha.laboral}
        onActualizado={(laboral) => setFicha((f) => ({ ...f, laboral: { ...f.laboral, ...laboral } }))}
      />
    ) : (
      <TabPersonales ficha={ficha} setFicha={setFicha} />
    );
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Mi Salud"
        titulo="Mi ficha"
        subtitulo="Mantené tus datos al día para que el servicio de salud pueda acompañarte mejor."
      />

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        Tus datos los carga Capital Humano. Si encontrás un error, corregilo: el cambio se aplica enseguida y Capital
        Humano lo revisa.
      </Alert>

      <Tabs
        value={seccion}
        onChange={(_e, valor) => setParams({ seccion: valor }, { replace: true })}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Secciones de la ficha"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        {SECCIONES_FICHA.map((s) => (
          <Tab key={s.id} value={s.id} label={s.texto} id={`tab-${s.id}`} aria-controls={`panel-${s.id}`} />
        ))}
      </Tabs>

      <div role="tabpanel" id={`panel-${seccion}`} aria-labelledby={`tab-${seccion}`}>
        {contenido()}
      </div>
    </main>
  );
};

export default FichaSalud;
