const { cuilValido, normalizarCuil } = require("../../utils/cuil");
const { limpiarTexto } = require("../../utils/texto");

// Registro normalizado de empleado: el contrato que entrega TODA fuente
// (CSV de RRHH, CiDiTuc, Portal del Empleado). El motor del padrón solo conoce este formato.
//
//   {
//     legajo: number,               // clave de vínculo con el `afiliado` de CiDiTuc
//     cuil: "11 dígitos",
//     apellido, nombre: string,
//     reparticion: string | null,   // nombre
//     id_reparticion: number | null,// id de CiDiTuc (ámbito de los roles)
//     laborales: { area?, puesto?, actividad? }  // solo los campos que la fuente informa
//   }
const CAMPOS_LABORALES = { area: 160, puesto: 160, actividad: 240 };

// Valida un registro crudo ya mapeado a los nombres del contrato.
// Devuelve { registro } o { problemas: [...] }.
function validarRegistro(crudo) {
  const problemas = [];

  const legajo = Number(String(crudo.legajo ?? "").trim());
  if (!Number.isInteger(legajo) || legajo <= 0 || legajo > 99999999) problemas.push("legajo inválido");

  const cuil = normalizarCuil(crudo.cuil);
  if (!cuilValido(cuil)) problemas.push("CUIL inválido");

  const apellido = limpiarTexto(crudo.apellido, 120);
  const nombre = limpiarTexto(crudo.nombre, 120);
  if (!apellido) problemas.push("falta el apellido");
  if (!nombre) problemas.push("falta el nombre");

  const idRepTexto = String(crudo.id_reparticion ?? "").trim();
  const idReparticion = idRepTexto === "" ? null : Number(idRepTexto);
  if (idReparticion !== null && (!Number.isInteger(idReparticion) || idReparticion <= 0)) problemas.push("id_reparticion inválido");

  if (problemas.length) return { problemas, legajo: Number.isInteger(legajo) ? legajo : null };

  const laborales = {};
  for (const [campo, max] of Object.entries(CAMPOS_LABORALES)) {
    const valor = limpiarTexto(crudo[campo], max);
    if (valor !== null) laborales[campo] = valor;
  }

  return {
    registro: {
      legajo,
      cuil,
      apellido,
      nombre,
      reparticion: limpiarTexto(crudo.reparticion, 160),
      id_reparticion: idReparticion,
      laborales,
    },
  };
}

// Valida una lista de registros crudos. `posicion(i)` da el número que se muestra en los errores
// (línea del archivo para el CSV, número de registro para las fuentes remotas).
function validarLote(crudos, posicion = (i) => i + 1) {
  const registros = [];
  const errores = [];
  const vistos = new Map();
  crudos.forEach((crudo, i) => {
    const linea = posicion(i);
    const resultado = validarRegistro(crudo);
    if (resultado.problemas) {
      errores.push({ linea, legajo: resultado.legajo, mensaje: resultado.problemas.join("; ") });
      return;
    }
    const { registro } = resultado;
    if (vistos.has(registro.legajo)) {
      errores.push({ linea, legajo: registro.legajo, mensaje: `legajo repetido (también en la línea ${vistos.get(registro.legajo)})` });
      return;
    }
    vistos.set(registro.legajo, linea);
    registros.push({ ...registro, linea });
  });
  return { registros, errores, totalFilas: crudos.length };
}

module.exports = { validarRegistro, validarLote, CAMPOS_LABORALES };
