import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import TablaEsqueleto from "../../components/Esqueletos/TablaEsqueleto";
import DialogoImportacion from "../../components/Gestion/DialogoImportacion";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useCarga from "../../hooks/useCarga";
import useSaludStore from "../../Zustand/useSaludStore";
import { avisarError, avisarExito } from "../../helpers/avisos";
import { puedeImportarPadron, veePadron } from "../../helpers/roles";
import { ErrorCarga } from "../../components/Salud/Ficha/Comunes";

const POR_PAGINA = 25;
const formatearCuil = (c) => (c?.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);

// Descarga la plantilla CSV con la sesión del portal.
const descargarPlantilla = async () => {
  try {
    const { data } = await axiosSalud.get("/gestion/padron/plantilla", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = Object.assign(document.createElement("a"), { href: url, download: "plantilla-padron-empleados.csv" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    avisarError(mensajeDeError(e));
  }
};

const Padron = () => {
  const roles = useSaludStore((s) => s.roles);
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [pagina, setPagina] = useState(1);
  // null = cerrado; { id: "csv" } = archivo; { id, nombre } = fuente remota.
  const [importando, setImportando] = useState(null);
  const { datos: datosFuentes } = useCarga("/gestion/padron/fuentes");
  const remotas = (datosFuentes?.fuentes || []).filter((f) => f.id !== "csv");
  const { datos, cargando, error, recargar } = useCarga(
    `/gestion/padron?pagina=${pagina}${consulta ? `&buscar=${encodeURIComponent(consulta)}` : ""}`
  );

  // Busca mientras se escribe, con una pequeña espera.
  useEffect(() => {
    const id = setTimeout(() => {
      setConsulta(busqueda.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(id);
  }, [busqueda]);

  if (!veePadron(roles)) {
    return (
      <main className="ps-pagina">
        <EncabezadoPagina volver="/salud" titulo="Padrón de empleados" />
        <Alert severity="warning">No tenés permiso para consultar el padrón.</Alert>
      </main>
    );
  }

  const alImportar = (resultado) => {
    setImportando(null);
    const r = resultado.resumen;
    avisarExito(`Padrón importado: ${r.altas} altas, ${r.actualizaciones} actualizaciones`);
    recargar();
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Capital Humano"
        titulo="Padrón de empleados"
        subtitulo="Empleados importados desde RRHH. Quien todavía no ingresó al portal queda vinculado en su primer ingreso."
        acciones={
          <>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={descargarPlantilla}>
              Plantilla CSV
            </Button>
            {puedeImportarPadron(roles) && (
              <Button variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => setImportando({ id: "csv" })}>
                Importar padrón
              </Button>
            )}
          </>
        }
      />

      <div className="ps-pila">
        {remotas.length > 0 && (
          <section className="cd-superficie ps-tarjeta" aria-labelledby="t-fuentes">
            <div className="ps-bloque__cabecera">
              <div>
                <h2 className="ps-tarjeta__titulo" id="t-fuentes">
                  Fuentes de datos
                </h2>
                <p className="ps-bloque__descripcion">
                  Los datos de los empleados van a venir de los sistemas municipales. Mientras una integración no esté
                  habilitada, se usa la importación por CSV.
                </p>
              </div>
            </div>
            <ul className="ps-lista">
              {remotas.map((f) => (
                <li className="ps-lista__item" key={f.id}>
                  <span className="ps-lista__textos">
                    <span className="ps-lista__principal">{f.nombre}</span>
                    <span className="ps-lista__secundario">{f.descripcion}</span>
                  </span>
                  {f.disponible && puedeImportarPadron(roles) ? (
                    <Button size="small" variant="outlined" startIcon={<SyncRoundedIcon />} onClick={() => setImportando(f)}>
                      Sincronizar
                    </Button>
                  ) : (
                    <Chip
                      size="small"
                      label={f.disponible ? "Habilitada" : "Integración pendiente"}
                      sx={{ bgcolor: "var(--cd-hover)", color: "var(--cd-text-2)", flexShrink: 0 }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <TextField
          size="small"
          placeholder="Buscar por legajo, CUIL, apellido o nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          inputProps={{ "aria-label": "Buscar en el padrón", maxLength: 80 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 480 }}
        />

        {cargando && !datos && <TablaEsqueleto />}
        {error && <ErrorCarga error={error} onReintentar={recargar} />}
        {datos && (
          <TableContainer component={Paper}>
            <Table size="small" aria-label="Padrón de empleados">
              <TableHead>
                <TableRow>
                  <TableCell>Legajo</TableCell>
                  <TableCell>Apellido y nombre</TableCell>
                  <TableCell>CUIL</TableCell>
                  <TableCell>Repartición</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {datos.empleados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      {consulta ? "No hay empleados que coincidan con la búsqueda." : "Todavía no se importó el padrón."}
                    </TableCell>
                  </TableRow>
                )}
                {datos.empleados.map((e) => (
                  <TableRow key={e.legajo}>
                    <TableCell>{e.legajo}</TableCell>
                    <TableCell>
                      {e.apellido}, {e.nombre}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatearCuil(e.cuil)}</TableCell>
                    <TableCell>{e.reparticion || "—"}</TableCell>
                    <TableCell>
                      <span className="d-flex flex-wrap gap-1">
                        {!e.activo && <Chip size="small" label="Inactivo" />}
                        <Chip
                          size="small"
                          label={e.ingresoAlPortal ? "Ingresó al portal" : "Aún no ingresó"}
                          sx={{
                            bgcolor: e.ingresoAlPortal ? "var(--cd-verde-bg)" : "var(--cd-hover)",
                            color: "var(--cd-text)",
                          }}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={datos.total}
              page={pagina - 1}
              onPageChange={(_e, p) => setPagina(p + 1)}
              rowsPerPage={POR_PAGINA}
              rowsPerPageOptions={[POR_PAGINA]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </TableContainer>
        )}
      </div>

      <DialogoImportacion
        abierto={Boolean(importando)}
        fuente={importando}
        onCerrar={() => setImportando(null)}
        onImportado={alImportar}
      />
    </main>
  );
};

export default Padron;
