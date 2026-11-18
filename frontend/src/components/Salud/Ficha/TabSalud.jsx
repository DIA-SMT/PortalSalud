import { useState } from "react";
import { Alert, Button, IconButton, Tooltip } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { confirmarBorrado } from "../../../common/alerta";
import { avisarError, avisarExito } from "../../../helpers/avisos";
import useCarga from "../../../hooks/useCarga";
import { BloqueFicha, CargandoBloques, ErrorCarga, EstadoDatoChip } from "./Comunes";
import FormCorregible from "./FormCorregible";
import { CATEGORIAS_SALUD } from "./categorias";
import DialogoDeclaracion from "./DialogoDeclaracion";

const GRUPOS = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const CAMPOS_BASICOS = [
  { clave: "grupoSanguineo", etiqueta: "Grupo sanguíneo", opciones: GRUPOS },
  { clave: "cobertura", etiqueta: "Obra social o prepaga", max: 160 },
];

// Cada dato básico tiene su propio endpoint: se guardan los que cambiaron.
const guardarBasicos = async (cuerpo) => {
  const resultado = {};
  if (cuerpo.grupoSanguineo !== undefined) {
    resultado.grupoSanguineo = (
      await axiosSalud.put("/salud/ficha/salud/grupo-sanguineo", { grupoSanguineo: cuerpo.grupoSanguineo })
    ).data;
  }
  if (cuerpo.cobertura !== undefined) {
    resultado.cobertura = (await axiosSalud.put("/salud/ficha/salud/cobertura", { cobertura: cuerpo.cobertura })).data;
  }
  return resultado;
};

const TabSalud = () => {
  const { datos, setDatos, cargando, error, recargar } = useCarga("/salud/ficha/salud");
  const [dialogo, setDialogo] = useState({ abierto: false, categoria: null, declaracion: null });

  if (cargando) return <CargandoBloques />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;

  const cerrarDialogo = () => setDialogo({ abierto: false, categoria: null, declaracion: null });

  const alGuardar = (guardada) => {
    setDatos((d) => {
      const existe = d.declaraciones.some((x) => x.id === guardada.id);
      return {
        ...d,
        declaraciones: existe
          ? d.declaraciones.map((x) => (x.id === guardada.id ? guardada : x))
          : [guardada, ...d.declaraciones],
      };
    });
    cerrarDialogo();
    avisarExito("Dato de salud guardado");
  };

  const darDeBaja = async (declaracion) => {
    const { isConfirmed } = await confirmarBorrado({
      title: "¿Quitar este dato?",
      text:
        declaracion.estado === "empleado" || declaracion.estado === "pendiente_revision"
          ? "Dejará de figurar en tu ficha."
          : "Dejará de figurar en tu ficha y Capital Humano va a revisar el cambio.",
      confirmButtonText: "Quitar",
    });
    if (!isConfirmed) return;
    try {
      await axiosSalud.delete(`/salud/ficha/salud/declaraciones/${declaracion.id}`);
      setDatos((d) => ({ ...d, declaraciones: d.declaraciones.filter((x) => x.id !== declaracion.id) }));
      avisarExito("Dato quitado");
    } catch (e) {
      avisarError(mensajeDeError(e));
    }
  };

  return (
    <div className="ps-pila">
      <Alert severity="info" icon={<LockOutlinedIcon fontSize="inherit" />}>
        Esta información es confidencial: solo la ven vos, el personal de salud autorizado y las personas de Capital
        Humano habilitadas para cargarla.
      </Alert>

      <BloqueFicha id="b-basicos" titulo="Datos básicos">
        <FormCorregible
          campos={CAMPOS_BASICOS}
          datos={datos}
          guardar={guardarBasicos}
          onGuardado={(cambios) => setDatos((d) => ({ ...d, ...cambios }))}
          textoExito="Datos de salud guardados"
        />
      </BloqueFicha>

      {Object.entries(CATEGORIAS_SALUD).map(([clave, info]) => {
        const items = datos.declaraciones.filter((d) => d.categoria === clave);
        return (
          <BloqueFicha
            key={clave}
            id={`b-${clave}`}
            titulo={info.titulo}
            acciones={
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => setDialogo({ abierto: true, categoria: clave, declaracion: null })}
                aria-label={`Agregar ${info.singular}`}
              >
                Agregar
              </Button>
            }
          >
            {items.length === 0 ? (
              <p className="ps-tarjeta__vacio">{info.vacio}</p>
            ) : (
              <ul className="ps-lista">
                {items.map((d) => (
                  <li className="ps-lista__item" key={d.id}>
                    <span className="ps-lista__textos">
                      <span className="ps-lista__principal">{d.descripcion}</span>
                      <span className="mt-1">
                        <EstadoDatoChip estado={d.estado} />
                      </span>
                    </span>
                    <span className="cd-acciones">
                      <Tooltip title="Corregir">
                        <IconButton
                          aria-label={`Corregir ${info.singular}`}
                          onClick={() => setDialogo({ abierto: true, categoria: clave, declaracion: d })}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Quitar">
                        <IconButton aria-label={`Quitar ${info.singular}`} onClick={() => darDeBaja(d)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </BloqueFicha>
        );
      })}

      <DialogoDeclaracion
        abierto={dialogo.abierto}
        categoria={dialogo.categoria}
        declaracion={dialogo.declaracion}
        onCerrar={cerrarDialogo}
        onGuardado={alGuardar}
      />
    </div>
  );
};

export default TabSalud;
