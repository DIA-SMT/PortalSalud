/* eslint-disable react/prop-types */
import { BloqueFicha, DatoFicha } from "./Comunes";
import FormCorregible from "./FormCorregible";
import { guardarCon } from "../../../helpers/api";
import { formatearFecha } from "../../../helpers/fechas";

const CAMPOS_LABORALES = [
  { clave: "area", etiqueta: "Área", max: 160 },
  { clave: "puesto", etiqueta: "Puesto", max: 160 },
  { clave: "actividad", etiqueta: "Actividad laboral", max: 240, ancho: "completo" },
];

const TabLaboral = ({ laboral, onActualizado }) => (
  <div className="ps-pila">
    <BloqueFicha
      id="b-laboral"
      titulo="Información laboral"
      descripcion="Legajo y dependencia vienen de tu legajo municipal. Área, puesto y actividad los carga Capital Humano."
    >
      <dl className="ps-datos">
        <DatoFicha etiqueta="Legajo" valor={laboral.legajo ? String(laboral.legajo) : null} />
        <DatoFicha etiqueta="Dependencia" valor={laboral.reparticion} />
      </dl>
      <FormCorregible
        campos={CAMPOS_LABORALES}
        datos={laboral}
        guardar={guardarCon("/salud/ficha/laboral")}
        onGuardado={onActualizado}
        textoExito="Información laboral guardada"
      />
    </BloqueFicha>

    <BloqueFicha
      id="b-riesgos"
      titulo="Riesgos ocupacionales identificados"
      descripcion="Los registra el personal autorizado de salud laboral a partir de tu puesto y tus tareas."
    >
      {laboral.riesgos.length === 0 ? (
        <p className="ps-tarjeta__vacio">No hay riesgos ocupacionales registrados para tu puesto.</p>
      ) : (
        <ul className="ps-lista">
          {laboral.riesgos.map((r) => (
            <li className="ps-lista__item" key={r.id}>
              <span className="ps-lista__textos">
                <span className="ps-lista__principal">{r.descripcion}</span>
                <span className="ps-lista__secundario">Identificado el {formatearFecha(r.fechaIdentificacion)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </BloqueFicha>
  </div>
);

export default TabLaboral;
