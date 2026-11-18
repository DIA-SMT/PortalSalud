import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EncabezadoPagina from "../../common/EncabezadoPagina";
import axiosSalud, { mensajeDeError } from "../../config/axiosSalud";
import useCarga from "../../hooks/useCarga";
import useSaludStore from "../../Zustand/useSaludStore";
import { avisarError } from "../../helpers/avisos";
import { CargandoBloques, ErrorCarga } from "../../components/Salud/Ficha/Comunes";
import PreferenciasNotificacion from "../../components/Salud/Recordatorios/PreferenciasNotificacion";

const FORMATO = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const Recordatorios = () => {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const setNoLeidos = useSaludStore((s) => s.setNoLeidos);
  const lista = useCarga("/salud/recordatorios");
  const prefs = useCarga("/salud/preferencias");

  useEffect(() => {
    if (lista.datos) setNoLeidos(lista.datos.noLeidos);
  }, [lista.datos, setNoLeidos]);

  // Acceso directo a las preferencias (#preferencias) desde el dashboard.
  useEffect(() => {
    if (hash === "#preferencias" && prefs.datos) {
      document.getElementById("preferencias")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash, prefs.datos]);

  const actualizarLista = (transformar) =>
    lista.setDatos((d) => {
      const recordatorios = transformar(d.recordatorios);
      return { recordatorios, noLeidos: recordatorios.filter((r) => !r.leidoEn).length };
    });

  const marcarLeido = async (id) => {
    try {
      const { data } = await axiosSalud.post(`/salud/recordatorios/${id}/leido`);
      actualizarLista((rs) => rs.map((r) => (r.id === id ? data : r)));
    } catch (error) {
      avisarError(mensajeDeError(error));
    }
  };

  const marcarTodos = async () => {
    try {
      await axiosSalud.post("/salud/recordatorios/leidos");
      const ahora = new Date().toISOString();
      actualizarLista((rs) => rs.map((r) => (r.leidoEn ? r : { ...r, leidoEn: ahora })));
    } catch (error) {
      avisarError(mensajeDeError(error));
    }
  };

  const contenidoLista = () => {
    if (lista.cargando) return <CargandoBloques />;
    if (lista.error) return <ErrorCarga error={lista.error} onReintentar={lista.recargar} />;
    const { recordatorios } = lista.datos;
    return (
      <section className="cd-superficie ps-tarjeta" aria-labelledby="t-lista-recordatorios">
        <h2 className="visually-hidden" id="t-lista-recordatorios">
          Tus recordatorios
        </h2>
        {recordatorios.length === 0 ? (
          <p className="ps-tarjeta__vacio">No tenés recordatorios por ahora.</p>
        ) : (
          <ul className="ps-recordatorios">
            {recordatorios.map((r) => (
              <li key={r.id} className={`ps-recordatorio${r.leidoEn ? "" : " ps-recordatorio--nuevo"}`}>
                <span className="ps-recordatorio__marca" aria-hidden="true" />
                <div className="ps-recordatorio__cuerpo">
                  <p className="ps-recordatorio__titulo">
                    {r.titulo}
                    {!r.leidoEn && <span className="visually-hidden"> (sin leer)</span>}
                  </p>
                  <p className="ps-recordatorio__mensaje">{r.mensaje}</p>
                  <p className="ps-recordatorio__fecha">{FORMATO.format(new Date(r.programadoPara))}</p>
                  <div className="ps-recordatorio__acciones">
                    {r.idControl && (
                      <Button
                        size="small"
                        startIcon={<EventAvailableOutlinedIcon />}
                        onClick={() => navigate(`/salud/controles?control=${r.idControl}`)}
                      >
                        Ver control
                      </Button>
                    )}
                    {!r.leidoEn && (
                      <Button size="small" startIcon={<CheckRoundedIcon />} onClick={() => marcarLeido(r.id)}>
                        Marcar como leído
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <main className="ps-pagina">
      <EncabezadoPagina
        volver="/salud"
        sup="Mi Salud"
        titulo="Recordatorios"
        subtitulo="Avisos sobre tus controles, turnos y documentación."
        acciones={
          lista.datos?.noLeidos > 0 && (
            <Button variant="outlined" startIcon={<DoneAllRoundedIcon />} onClick={marcarTodos}>
              Marcar todos como leídos
            </Button>
          )
        }
      />
      <div className="ps-pila">
        {contenidoLista()}
        {prefs.cargando && <CargandoBloques />}
        {prefs.error && <ErrorCarga error={prefs.error} onReintentar={prefs.recargar} />}
        {prefs.datos && <PreferenciasNotificacion preferencias={prefs.datos} onGuardadas={prefs.setDatos} />}
      </div>
    </main>
  );
};

export default Recordatorios;
