/* eslint-disable react/prop-types */
import { useState } from "react";
import { Alert, Button, IconButton, Tooltip } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import axiosSalud, { mensajeDeError } from "../../../config/axiosSalud";
import { confirmarBorrado } from "../../../common/alerta";
import { avisarError, avisarExito } from "../../../helpers/avisos";
import { validarEmail, validarTelefono } from "../../../helpers/validaciones";
import { BloqueFicha, DatoFicha } from "./Comunes";
import DialogoContacto from "./DialogoContacto";
import FormCorregible from "./FormCorregible";
import { guardarCon } from "../../../helpers/api";

const MAX_CONTACTOS = 5;

const CAMPOS_CONTACTO = [
  { clave: "telefonoAlternativo", etiqueta: "Teléfono alternativo", tipo: "tel", max: 30, validar: (v) => validarTelefono(v) },
  { clave: "emailAlternativo", etiqueta: "Correo alternativo", tipo: "email", max: 120, validar: validarEmail },
];

const TabPersonales = ({ ficha, setFicha }) => {
  const [dialogo, setDialogo] = useState({ abierto: false, contacto: null });
  const contactos = ficha.contactosEmergencia;

  const alGuardarContacto = (guardado) => {
    setFicha((f) => {
      const existe = f.contactosEmergencia.some((c) => c.id === guardado.id);
      return {
        ...f,
        contactosEmergencia: existe
          ? f.contactosEmergencia.map((c) => (c.id === guardado.id ? guardado : c))
          : [...f.contactosEmergencia, guardado],
      };
    });
    setDialogo({ abierto: false, contacto: null });
    avisarExito("Contacto de emergencia guardado");
  };

  const eliminar = async (contacto) => {
    const { isConfirmed } = await confirmarBorrado({
      title: "¿Eliminar contacto?",
      text: `Se quitará a ${contacto.nombre} de tus contactos de emergencia.`,
    });
    if (!isConfirmed) return;
    try {
      await axiosSalud.delete(`/salud/ficha/contactos-emergencia/${contacto.id}`);
      setFicha((f) => ({ ...f, contactosEmergencia: f.contactosEmergencia.filter((c) => c.id !== contacto.id) }));
      avisarExito("Contacto eliminado");
    } catch (error) {
      avisarError(mensajeDeError(error));
    }
  };

  return (
    <div className="ps-pila">
      <BloqueFicha
        id="b-identificacion"
        titulo="Datos identificatorios"
        descripcion="Vienen de tu cuenta de Ciudad Digital. Si hay un error, corregilo desde tu perfil de Ciudad Digital."
      >
        <dl className="ps-datos">
          <DatoFicha etiqueta="Nombre" valor={ficha.personales.nombre} />
          <DatoFicha etiqueta="Apellido" valor={ficha.personales.apellido} />
        </dl>
      </BloqueFicha>

      <BloqueFicha
        id="b-contacto"
        titulo="Medios de contacto"
        descripcion="Los carga Capital Humano. Se usan solo para comunicarte cuestiones de tus controles."
      >
        <FormCorregible
          campos={CAMPOS_CONTACTO}
          datos={ficha.contacto}
          guardar={guardarCon("/salud/ficha/contacto")}
          onGuardado={(contacto) => setFicha((f) => ({ ...f, contacto }))}
          textoExito="Medios de contacto guardados"
        />
      </BloqueFicha>

      <BloqueFicha
        id="b-emergencia"
        titulo="Contactos de emergencia"
        descripcion={`A quién avisar si te pasa algo en el trabajo. Podés cargar hasta ${MAX_CONTACTOS}.`}
        acciones={
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogo({ abierto: true, contacto: null })}
            disabled={contactos.length >= MAX_CONTACTOS}
          >
            Agregar
          </Button>
        }
      >
        {contactos.length === 0 ? (
          <Alert severity="info">Todavía no cargaste ningún contacto de emergencia.</Alert>
        ) : (
          <ul className="ps-lista">
            {contactos.map((c) => (
              <li className="ps-lista__item" key={c.id}>
                <span className="ps-lista__textos">
                  <span className="ps-lista__principal">{c.nombre}</span>
                  <span className="ps-lista__secundario">
                    {c.vinculo} · {c.telefono}
                    {c.telefonoAlternativo ? ` · ${c.telefonoAlternativo}` : ""}
                  </span>
                </span>
                <span className="cd-acciones">
                  <Tooltip title="Editar">
                    <IconButton aria-label={`Editar a ${c.nombre}`} onClick={() => setDialogo({ abierto: true, contacto: c })}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton aria-label={`Eliminar a ${c.nombre}`} onClick={() => eliminar(c)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </BloqueFicha>

      <DialogoContacto
        abierto={dialogo.abierto}
        contacto={dialogo.contacto}
        onCerrar={() => setDialogo({ abierto: false, contacto: null })}
        onGuardado={alGuardarContacto}
      />
    </div>
  );
};

export default TabPersonales;
