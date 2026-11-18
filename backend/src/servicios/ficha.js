const CustomError = require("../utils/CustomError");
const { aISO } = require("../utils/fechas");

const MAX_CONTACTOS_EMERGENCIA = 5;
const CATEGORIAS = ["alergia", "antecedente", "condicion", "medicacion"];
const GRUPOS_SANGUINEOS = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

// Campos que carga Capital Humano y que el empleado puede corregir (con revisión posterior).
const CAMPOS_CONTACTO = { telefonoAlternativo: "telefono_alternativo", emailAlternativo: "email_alternativo" };
const CAMPOS_LABORALES = { area: "area", puesto: "puesto", actividad: "actividad" };

const vacioANull = (valor) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
};

const mapearContacto = (c) => ({
  id: c.id,
  nombre: c.nombre,
  vinculo: c.vinculo,
  telefono: c.telefono,
  telefonoAlternativo: c.telefono_alternativo,
  prioridad: c.prioridad,
});

const idInsertado = (filas) => filas.map((f) => (typeof f === "object" ? f.id : f))[0];

// Estado de un dato para mostrarle al empleado:
//   pendiente_revision -> lo modificó el empleado y Capital Humano todavía no lo revisó
//   revisado           -> la última corrección del empleado ya fue revisada
//   capital_humano | servicio_salud | empleado -> quién lo cargó
//   sin_datos
const estadoDato = (valor, correcciones, origen) => {
  if (correcciones.some((c) => c.estado === "pendiente")) return "pendiente_revision";
  if (correcciones.length) return "revisado";
  if (valor === null || valor === undefined || valor === "") return "sin_datos";
  return origen || "empleado";
};

const snapshotPersona = (identidad) => ({
  persona_nombre: `${identidad.nombre} ${identidad.apellido}`.trim().slice(0, 160),
  persona_legajo: identidad.legajo ?? null,
  id_reparticion: identidad.id_reparticion ?? null,
  reparticion: identidad.reparticion ?? null,
});

// Todas las funciones del empleado reciben su identidad desde la sesión y filtran
// SIEMPRE por su id_persona: un id de registro ajeno se comporta como inexistente (404).
function crearServicioFicha({ admin, clinica }, cifrador) {
  // ================= Datos administrativos =================

  // Registra (o actualiza) la corrección pendiente de un campo. Si el empleado vuelve
  // al valor original antes de la revisión, la corrección desaparece.
  const registrarCorreccion = async (trx, identidad, seccion, campo, anterior, nuevo, ahora) => {
    if ((anterior ?? null) === (nuevo ?? null)) return;
    const pendiente = await trx("correccion_ficha")
      .where({ id_persona: identidad.id_persona, seccion, campo, estado: "pendiente" })
      .first();
    if (pendiente) {
      if ((pendiente.valor_anterior ?? null) === (nuevo ?? null)) {
        await trx("correccion_ficha").where({ id: pendiente.id }).del();
      } else {
        await trx("correccion_ficha").where({ id: pendiente.id }).update({ valor_nuevo: nuevo, actualizado_en: ahora });
      }
      return;
    }
    await trx("correccion_ficha").insert({
      id_persona: identidad.id_persona,
      seccion,
      campo,
      valor_anterior: anterior ?? null,
      valor_nuevo: nuevo ?? null,
      estado: "pendiente",
      ...snapshotPersona(identidad),
      creado_en: ahora,
      actualizado_en: ahora,
    });
  };

  const camposConEstado = (fila, mapa, seccion, correcciones) =>
    Object.fromEntries(
      Object.entries(mapa).map(([clave, columna]) => {
        const valor = fila?.[columna] ?? null;
        const propias = correcciones.filter((c) => c.seccion === seccion && c.campo === columna);
        return [clave, { valor, estado: estadoDato(valor, propias, fila?.origen) }];
      })
    );

  const obtenerAdministrativa = async (identidad) => {
    const idPersona = identidad.id_persona;
    const [contacto, laborales, contactos, riesgos, correcciones] = await Promise.all([
      admin("datos_contacto").where({ id_persona: idPersona }).first(),
      admin("datos_laborales").where({ id_persona: idPersona }).first(),
      admin("contacto_emergencia").where({ id_persona: idPersona }).orderBy([{ column: "prioridad" }, { column: "id" }]),
      admin("riesgo_ocupacional").where({ id_persona: idPersona, vigente: true }).orderBy("fecha_identificacion", "desc"),
      admin("correccion_ficha").where({ id_persona: idPersona }).select("seccion", "campo", "estado"),
    ]);

    return {
      personales: { nombre: identidad.nombre, apellido: identidad.apellido },
      contacto: camposConEstado(contacto, CAMPOS_CONTACTO, "contacto", correcciones),
      contactosEmergencia: contactos.map(mapearContacto),
      laboral: {
        legajo: identidad.legajo,
        reparticion: identidad.reparticion,
        ...camposConEstado(laborales, CAMPOS_LABORALES, "laboral", correcciones),
        riesgos: riesgos.map((r) => ({ id: r.id, descripcion: r.descripcion, fechaIdentificacion: r.fecha_identificacion })),
      },
    };
  };

  // Corrección de una sección administrativa por el empleado: se aplica ya y queda para revisión.
  const corregirSeccion = (tabla, seccion, mapa) => async (identidad, datos) => {
    const idPersona = identidad.id_persona;
    const ahora = new Date();
    await admin.transaction(async (trx) => {
      const actual = await trx(tabla).where({ id_persona: idPersona }).first();
      const cambios = {};
      for (const [clave, columna] of Object.entries(mapa)) {
        if (datos[clave] === undefined) continue;
        const nuevo = vacioANull(datos[clave]);
        await registrarCorreccion(trx, identidad, seccion, columna, actual?.[columna] ?? null, nuevo, ahora);
        cambios[columna] = nuevo;
      }
      if (actual) {
        await trx(tabla).where({ id_persona: idPersona }).update({ ...cambios, actualizado_por: idPersona, actualizado_en: ahora });
      } else {
        await trx(tabla).insert({ id_persona: idPersona, ...cambios, origen: "empleado", actualizado_por: idPersona, actualizado_en: ahora });
      }
    });
    return (await obtenerAdministrativa(identidad))[seccion === "contacto" ? "contacto" : "laboral"];
  };

  const guardarContacto = corregirSeccion("datos_contacto", "contacto", CAMPOS_CONTACTO);
  const guardarLaboral = corregirSeccion("datos_laborales", "laboral", CAMPOS_LABORALES);

  // ----- Contactos de emergencia: los carga el propio empleado (sin revisión) -----

  const crearContactoEmergencia = async (idPersona, datos) => {
    const { cantidad } = await admin("contacto_emergencia").where({ id_persona: idPersona }).count({ cantidad: "*" }).first();
    if (Number(cantidad) >= MAX_CONTACTOS_EMERGENCIA) {
      throw new CustomError(`Podés cargar hasta ${MAX_CONTACTOS_EMERGENCIA} contactos de emergencia.`, 409);
    }
    const ahora = new Date();
    const id = await admin("contacto_emergencia")
      .insert({
        id_persona: idPersona,
        nombre: datos.nombre.trim(),
        vinculo: datos.vinculo.trim(),
        telefono: datos.telefono.trim(),
        telefono_alternativo: vacioANull(datos.telefonoAlternativo),
        prioridad: datos.prioridad ?? Number(cantidad) + 1,
        creado_en: ahora,
        actualizado_en: ahora,
      })
      .returning("id")
      .then(idInsertado);
    return mapearContacto(await admin("contacto_emergencia").where({ id }).first());
  };

  const actualizarContactoEmergencia = async (idPersona, id, datos) => {
    const filas = await admin("contacto_emergencia")
      .where({ id, id_persona: idPersona })
      .update({
        nombre: datos.nombre.trim(),
        vinculo: datos.vinculo.trim(),
        telefono: datos.telefono.trim(),
        telefono_alternativo: vacioANull(datos.telefonoAlternativo),
        ...(datos.prioridad !== undefined ? { prioridad: datos.prioridad } : {}),
        actualizado_en: new Date(),
      });
    if (!filas) throw new CustomError("Contacto no encontrado", 404);
    return mapearContacto(await admin("contacto_emergencia").where({ id }).first());
  };

  const eliminarContactoEmergencia = async (idPersona, id) => {
    const filas = await admin("contacto_emergencia").where({ id, id_persona: idPersona }).del();
    if (!filas) throw new CustomError("Contacto no encontrado", 404);
  };

  // ================= Datos clínicos =================

  const descifrar = (v) => (v === null || v === undefined ? null : cifrador.descifrar(v));
  const cifrar = (v) => (v === null || v === undefined ? null : cifrador.cifrar(v));

  // Corrección clínica pendiente: una por campo (o por declaración). Valores cifrados.
  const registrarCorreccionClinica = async (trx, identidad, { campo, idDeclaracion = null, categoria = null, accion, anterior, nuevo }, ahora) => {
    const filtro = { id_persona: identidad.id_persona, campo, estado: "pendiente" };
    if (idDeclaracion) filtro.id_declaracion = idDeclaracion;
    const pendiente = await trx("correccion_clinica").where(filtro).first();

    if (pendiente) {
      const anteriorOriginal = descifrar(pendiente.valor_anterior_cif);
      // Lo creó y lo quitó antes de la revisión, o volvió al valor original: no queda nada que revisar.
      if ((pendiente.accion === "crear" && accion === "baja") || (accion !== "baja" && (anteriorOriginal ?? null) === (nuevo ?? null))) {
        await trx("correccion_clinica").where({ id: pendiente.id }).del();
        return;
      }
      await trx("correccion_clinica").where({ id: pendiente.id }).update({
        accion: accion === "baja" ? "baja" : pendiente.accion,
        valor_nuevo_cif: accion === "baja" ? null : cifrar(nuevo),
        actualizado_en: ahora,
      });
      return;
    }
    if (accion === "modificar" && (anterior ?? null) === (nuevo ?? null)) return;
    await trx("correccion_clinica").insert({
      id_persona: identidad.id_persona,
      campo,
      id_declaracion: idDeclaracion,
      categoria,
      accion,
      valor_anterior_cif: cifrar(anterior),
      valor_nuevo_cif: cifrar(nuevo),
      estado: "pendiente",
      ...snapshotPersona(identidad),
      creado_en: ahora,
      actualizado_en: ahora,
    });
  };

  const obtenerClinica = async (idPersona) => {
    const [ficha, declaraciones, correcciones] = await Promise.all([
      clinica("ficha_salud").where({ id_persona: idPersona }).first(),
      clinica("declaracion_salud")
        .where({ id_persona: idPersona, vigente: true })
        .orderBy([{ column: "categoria" }, { column: "creado_en", order: "desc" }]),
      clinica("correccion_clinica").where({ id_persona: idPersona }).select("campo", "id_declaracion", "estado"),
    ]);

    const de = (campo) => correcciones.filter((c) => c.campo === campo);
    const grupoCorrecciones = de("grupo_sanguineo");
    const grupoPendiente = grupoCorrecciones.some((c) => c.estado === "pendiente");
    // El grupo sanguíneo se muestra si lo confirmó el área responsable o si el propio
    // empleado lo acaba de corregir (en ese caso, marcado como pendiente de revisión).
    const grupoVisible = Boolean(ficha?.grupo_sanguineo_confirmado) || grupoPendiente;
    const grupo = grupoVisible ? descifrar(ficha?.grupo_sanguineo_cif) : null;
    const cobertura = descifrar(ficha?.cobertura_cif);

    return {
      grupoSanguineo: { valor: grupo, estado: estadoDato(grupo, grupoCorrecciones, ficha?.origen) },
      cobertura: { valor: cobertura, estado: estadoDato(cobertura, de("cobertura"), ficha?.origen) },
      declaraciones: declaraciones.map((d) => ({
        id: d.id,
        categoria: d.categoria,
        descripcion: cifrador.descifrar(d.descripcion_cif),
        origen: d.origen,
        estado: estadoDato(d.id, correcciones.filter((c) => c.campo === "declaracion" && c.id_declaracion === d.id), d.origen),
        creadoEn: aISO(d.creado_en),
        actualizadoEn: aISO(d.actualizado_en),
      })),
    };
  };

  // Grupo sanguíneo o cobertura corregidos por el empleado.
  const corregirCampoFicha = async (identidad, campo, valor) => {
    const idPersona = identidad.id_persona;
    const ahora = new Date();
    const nuevo = vacioANull(valor);
    const columna = campo === "grupo_sanguineo" ? "grupo_sanguineo_cif" : "cobertura_cif";
    await clinica.transaction(async (trx) => {
      const ficha = await trx("ficha_salud").where({ id_persona: idPersona }).first();
      const anterior = descifrar(ficha?.[columna]);
      await registrarCorreccionClinica(trx, identidad, { campo, accion: "modificar", anterior, nuevo }, ahora);
      // La confirmación no se toca: mientras haya una corrección pendiente el dato se muestra
      // como "pendiente de revisión", y al revisarla el área responsable lo confirma.
      const cambios = { [columna]: cifrar(nuevo), actualizado_por: idPersona, actualizado_en: ahora };
      if (ficha) await trx("ficha_salud").where({ id_persona: idPersona }).update(cambios);
      else await trx("ficha_salud").insert({ id_persona: idPersona, ...cambios, origen: "empleado", creado_en: ahora });
    });
    return (await obtenerClinica(idPersona))[campo === "grupo_sanguineo" ? "grupoSanguineo" : "cobertura"];
  };

  const guardarGrupoSanguineo = (identidad, grupo) => corregirCampoFicha(identidad, "grupo_sanguineo", grupo);
  const guardarCobertura = (identidad, cobertura) => corregirCampoFicha(identidad, "cobertura", cobertura);

  const declaracionDe = async (idPersona, id) => {
    const fila = await clinica("declaracion_salud").where({ id, id_persona: idPersona, vigente: true }).first();
    if (!fila) throw new CustomError("Dato no encontrado", 404);
    return fila;
  };

  const declaracionConEstado = async (idPersona, id) =>
    (await obtenerClinica(idPersona)).declaraciones.find((d) => d.id === id);

  const crearDeclaracion = async (identidad, { categoria, descripcion }) => {
    const ahora = new Date();
    const texto = descripcion.trim();
    const id = await clinica.transaction(async (trx) => {
      const nuevoId = await trx("declaracion_salud")
        .insert({
          id_persona: identidad.id_persona,
          categoria,
          descripcion_cif: cifrador.cifrar(texto),
          origen: "empleado",
          registrado_por: identidad.id_persona,
          vigente: true,
          creado_en: ahora,
          actualizado_en: ahora,
        })
        .returning("id")
        .then(idInsertado);
      await registrarCorreccionClinica(
        trx,
        identidad,
        { campo: "declaracion", idDeclaracion: nuevoId, categoria, accion: "crear", anterior: null, nuevo: texto },
        ahora
      );
      return nuevoId;
    });
    return declaracionConEstado(identidad.id_persona, id);
  };

  // El empleado puede corregir cualquier dato de salud, también los que cargó Capital Humano.
  const actualizarDeclaracion = async (identidad, id, { descripcion }) => {
    const fila = await declaracionDe(identidad.id_persona, id);
    const ahora = new Date();
    const texto = descripcion.trim();
    await clinica.transaction(async (trx) => {
      await registrarCorreccionClinica(
        trx,
        identidad,
        {
          campo: "declaracion",
          idDeclaracion: id,
          categoria: fila.categoria,
          accion: "modificar",
          anterior: cifrador.descifrar(fila.descripcion_cif),
          nuevo: texto,
        },
        ahora
      );
      await trx("declaracion_salud").where({ id }).update({ descripcion_cif: cifrador.cifrar(texto), actualizado_en: ahora });
    });
    return declaracionConEstado(identidad.id_persona, id);
  };

  // No se borra: se da de baja (vigente = false) para poder revertir y conservar la trazabilidad.
  const darDeBajaDeclaracion = async (identidad, id) => {
    const fila = await declaracionDe(identidad.id_persona, id);
    const ahora = new Date();
    await clinica.transaction(async (trx) => {
      await registrarCorreccionClinica(
        trx,
        identidad,
        {
          campo: "declaracion",
          idDeclaracion: id,
          categoria: fila.categoria,
          accion: "baja",
          anterior: cifrador.descifrar(fila.descripcion_cif),
          nuevo: null,
        },
        ahora
      );
      await trx("declaracion_salud").where({ id }).update({ vigente: false, actualizado_en: ahora });
    });
  };

  return {
    obtenerAdministrativa,
    guardarContacto,
    guardarLaboral,
    crearContactoEmergencia,
    actualizarContactoEmergencia,
    eliminarContactoEmergencia,
    obtenerClinica,
    guardarGrupoSanguineo,
    guardarCobertura,
    crearDeclaracion,
    actualizarDeclaracion,
    darDeBajaDeclaracion,
  };
}

module.exports = {
  crearServicioFicha,
  CATEGORIAS,
  GRUPOS_SANGUINEOS,
  CAMPOS_CONTACTO,
  CAMPOS_LABORALES,
  MAX_CONTACTOS_EMERGENCIA,
};
