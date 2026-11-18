const CustomError = require("../utils/CustomError");
const { aISO } = require("../utils/fechas");
const { sinTildes } = require("../utils/texto");
const { analizarArchivoCsv, PLANTILLA } = require("./fuentesEmpleados/csv");
const { origenDeFuente } = require("./fuentesEmpleados");

// Texto de búsqueda: minúsculas y sin tildes, para encontrar "Hernández" escribiendo "hernandez".
const textoBusqueda = (apellido, nombre) => sinTildes(`${apellido} ${nombre}`).toLowerCase().slice(0, 260);

// Tablas con id_persona que hay que trasladar del id provisorio al real.
const TABLAS_ADMIN = [
  "datos_contacto",
  "datos_laborales",
  "preferencia_notificacion",
  "contacto_emergencia",
  "control_medico",
  "riesgo_ocupacional",
  "recordatorio",
  "documento_salud",
  "correccion_ficha",
  "solicitud_reprogramacion",
];
const TABLAS_CLAVE_PERSONA = ["datos_contacto", "datos_laborales", "preferencia_notificacion", "ficha_salud"];
const TABLAS_CLINICA = ["ficha_salud", "declaracion_salud", "registro_aptitud", "documento_clinico", "correccion_clinica"];

const idProvisorio = (fila) => -fila.id;

function crearServicioPadron({ admin, clinica }) {
  const persona = (fila) => fila.id_persona ?? idProvisorio(fila);

  // ---------------- Motor de aplicación (común a todas las fuentes) ----------------
  //
  // lote: { registros, errores, totalFilas } con el registro normalizado (fuentesEmpleados/registro.js).
  // Sin confirmar, solo calcula qué cambiaría; al confirmar lo aplica en una transacción.
  const aplicar = async (actor, lote, { fuente = "csv", nombreArchivo = null, confirmar = false, padronCompleto = false } = {}) => {
    const { registros: validas, errores, totalFilas } = lote;
    const origenLaboral = origenDeFuente(fuente);
    const existentes = new Map((await admin("padron_empleado").select()).map((p) => [p.legajo, p]));
    const vistos = new Map(
      (await admin("empleado_visto").whereNotNull("legajo").select("id_persona", "legajo")).map((e) => [e.legajo, e.id_persona])
    );

    const cambios = validas.map((f) => {
      const actual = existentes.get(f.legajo);
      if (!actual) return { ...f, tipo: "alta" };
      const distinto =
        actual.cuil !== f.cuil ||
        actual.apellido !== f.apellido ||
        actual.nombre !== f.nombre ||
        (f.reparticion !== null && actual.reparticion !== f.reparticion) ||
        (f.id_reparticion !== null && actual.id_reparticion !== f.id_reparticion) ||
        !actual.activo;
      return { ...f, tipo: distinto ? "actualizacion" : "sin_cambios", actual };
    });
    const enArchivo = new Set(validas.map((f) => f.legajo));
    const bajas = padronCompleto ? [...existentes.values()].filter((p) => p.activo && !enArchivo.has(p.legajo)) : [];

    const resumen = {
      filas: totalFilas,
      altas: cambios.filter((c) => c.tipo === "alta").length,
      actualizaciones: cambios.filter((c) => c.tipo === "actualizacion").length,
      sinCambios: cambios.filter((c) => c.tipo === "sin_cambios").length,
      bajas: bajas.length,
      errores: errores.length,
      conDatosLaborales: cambios.filter((c) => Object.keys(c.laborales).length).length,
    };
    const respuesta = {
      resumen,
      errores: errores.slice(0, 200),
      muestra: cambios
        .filter((c) => c.tipo !== "sin_cambios")
        .slice(0, 20)
        .map((c) => ({ linea: c.linea, legajo: c.legajo, nombre: `${c.apellido}, ${c.nombre}`, tipo: c.tipo })),
      confirmado: false,
    };
    if (!confirmar) return respuesta;

    const ahora = new Date();
    let omitidosPorCorreccion = 0;
    await admin.transaction(async (trx) => {
      const [idImportacion] = await trx("importacion_padron")
        .insert({
          archivo_nombre: String(nombreArchivo || fuente).slice(0, 200),
          fuente,
          filas_total: totalFilas,
          altas: resumen.altas,
          actualizaciones: resumen.actualizaciones,
          sin_cambios: resumen.sinCambios,
          bajas: resumen.bajas,
          errores: resumen.errores,
          padron_completo: padronCompleto,
          importado_por: actor.id_persona,
          creado_en: ahora,
        })
        .returning("id")
        .then((r) => r.map((x) => (typeof x === "object" ? x.id : x)));

      for (const c of cambios) {
        const datos = {
          cuil: c.cuil,
          apellido: c.apellido,
          nombre: c.nombre,
          busqueda: textoBusqueda(c.apellido, c.nombre),
          ...(c.reparticion !== null ? { reparticion: c.reparticion } : {}),
          ...(c.id_reparticion !== null ? { id_reparticion: c.id_reparticion } : {}),
          activo: true,
          id_importacion: idImportacion,
          actualizado_en: ahora,
        };
        let fila = c.actual;
        if (c.tipo === "alta") {
          // Si la persona ya ingresó al portal, se vincula en el momento.
          const idPersona = vistos.get(c.legajo) ?? null;
          await trx("padron_empleado").insert({
            legajo: c.legajo,
            ...datos,
            id_persona: idPersona,
            vinculado_en: idPersona ? ahora : null,
            creado_en: ahora,
          });
          fila = await trx("padron_empleado").where({ legajo: c.legajo }).first();
        } else if (c.tipo === "actualizacion") {
          await trx("padron_empleado").where({ id: fila.id }).update(datos);
        }
        omitidosPorCorreccion += await cargarLaborales(trx, persona(fila), c.laborales, { actor, origen: origenLaboral, ahora });
      }

      if (bajas.length) {
        await trx("padron_empleado").whereIn("id", bajas.map((b) => b.id)).update({ activo: false, actualizado_en: ahora });
      }
      respuesta.idImportacion = idImportacion;
    });
    return { ...respuesta, confirmado: true, omitidosPorCorreccion };
  };

  // Área, puesto y actividad: se marcan con el origen de la fuente, salvo los campos con una
  // corrección del empleado pendiente (esa la resuelve Capital Humano desde la bandeja).
  async function cargarLaborales(trx, idPersona, laborales, { actor, origen, ahora }) {
    const campos = Object.keys(laborales);
    if (!campos.length) return 0;
    const pendientes = new Set(
      (await trx("correccion_ficha").where({ id_persona: idPersona, seccion: "laboral", estado: "pendiente" }).select("campo")).map((c) => c.campo)
    );
    const aplicar = Object.fromEntries(campos.filter((c) => !pendientes.has(c)).map((c) => [c, laborales[c]]));
    if (Object.keys(aplicar).length) {
      const actual = await trx("datos_laborales").where({ id_persona: idPersona }).first();
      const fila = { ...aplicar, origen, actualizado_por: actor.id_persona, actualizado_en: ahora };
      if (actual) await trx("datos_laborales").where({ id_persona: idPersona }).update(fila);
      else await trx("datos_laborales").insert({ id_persona: idPersona, ...fila });
    }
    return campos.length - Object.keys(aplicar).length;
  }

  const listarImportaciones = async () =>
    (await admin("importacion_padron").orderBy("creado_en", "desc").limit(10)).map((i) => ({
      id: i.id,
      archivo: i.archivo_nombre,
      fuente: i.fuente,
      filas: i.filas_total,
      altas: i.altas,
      actualizaciones: i.actualizaciones,
      bajas: i.bajas,
      errores: i.errores,
      padronCompleto: Boolean(i.padron_completo),
      creadoEn: aISO(i.creado_en),
    }));

  // ---------------- Búsqueda ----------------

  const buscar = async ({ texto: busqueda = "", ambitos = null, pagina = 1, porPagina = 25 }) => {
    const q = admin("padron_empleado");
    if (ambitos !== null) q.whereIn("id_reparticion", ambitos);
    const t = String(busqueda).trim();
    if (t) {
      const digitos = t.replace(/\D/g, "");
      q.where((w) => {
        if (/^\d+$/.test(t) && t.length <= 8) w.orWhere("legajo", Number(t));
        if (digitos.length >= 6) w.orWhere("cuil", "like", `%${digitos}%`);
        const palabras = sinTildes(t).toLowerCase().split(/\s+/).filter((p) => p.length >= 2 && !/^\d+$/.test(p)).slice(0, 3);
        // Todas las palabras tienen que aparecer (apellido y/o nombre), sin importar tildes.
        if (palabras.length) w.orWhere((todas) => palabras.forEach((p) => todas.where("busqueda", "like", `%${p}%`)));
      });
    }
    const total = Number((await q.clone().count({ cantidad: "*" }).first()).cantidad);
    const filas = await q
      .orderBy([{ column: "apellido" }, { column: "nombre" }])
      .limit(porPagina)
      .offset((Math.max(1, pagina) - 1) * porPagina);
    return {
      total,
      pagina,
      empleados: filas.map((p) => ({
        legajo: p.legajo,
        cuil: p.cuil,
        apellido: p.apellido,
        nombre: p.nombre,
        reparticion: p.reparticion,
        activo: Boolean(p.activo),
        ingresoAlPortal: p.id_persona !== null,
      })),
    };
  };

  // ---------------- Vínculo al ingresar ----------------

  // Traslada todo lo cargado con el id provisorio al id real de CiDiTuc.
  const trasladar = async (trx, tablas, desde, hacia) => {
    for (const tabla of tablas) {
      if (TABLAS_CLAVE_PERSONA.includes(tabla) && (await trx(tabla).where({ id_persona: hacia }).first())) {
        // Ya existe un registro propio del empleado: se conserva ese y se descarta el provisorio.
        console.warn(`[padron] ${tabla}: se conserva el registro existente de la persona y se descarta el provisorio`);
        await trx(tabla).where({ id_persona: desde }).del();
        continue;
      }
      await trx(tabla).where({ id_persona: desde }).update({ id_persona: hacia });
    }
  };

  const vincular = async (identidad, ahora = new Date()) => {
    const visto = {
      legajo: identidad.legajo ?? null,
      persona_nombre: `${identidad.nombre} ${identidad.apellido}`.trim().slice(0, 160),
      id_reparticion: identidad.id_reparticion ?? null,
      reparticion: identidad.reparticion ?? null,
      ultimo_ingreso: ahora,
    };
    if (await admin("empleado_visto").where({ id_persona: identidad.id_persona }).first()) {
      await admin("empleado_visto").where({ id_persona: identidad.id_persona }).update(visto);
    } else {
      await admin("empleado_visto").insert({ id_persona: identidad.id_persona, ...visto });
    }
    if (!identidad.legajo) return null;

    const fila = await admin("padron_empleado").where({ legajo: identidad.legajo }).first();
    if (!fila) return null;
    const actualizacion = {};
    // La repartición que informa CiDiTuc define el ámbito de los roles.
    if (identidad.id_reparticion && fila.id_reparticion !== identidad.id_reparticion) {
      actualizacion.id_reparticion = identidad.id_reparticion;
    }
    if (fila.id_persona === null) {
      const desde = idProvisorio(fila);
      await clinica.transaction((trx) => trasladar(trx, TABLAS_CLINICA, desde, identidad.id_persona));
      await admin.transaction(async (trx) => {
        await trasladar(trx, TABLAS_ADMIN, desde, identidad.id_persona);
        await trx("auditoria_salud").where({ id_persona_titular: desde }).update({ id_persona_titular: identidad.id_persona });
      });
      Object.assign(actualizacion, { id_persona: identidad.id_persona, vinculado_en: ahora });
    }
    if (Object.keys(actualizacion).length) {
      await admin("padron_empleado").where({ id: fila.id }).update({ ...actualizacion, actualizado_en: ahora });
    }
    return fila.id;
  };

  // Persona (real o provisoria) y repartición de un legajo del padrón, para la carga de fichas.
  const resolverLegajo = async (legajo) => {
    const fila = await admin("padron_empleado").where({ legajo }).first();
    if (!fila) throw new CustomError("El legajo no está en el padrón.", 404);
    return { idPersona: persona(fila), fila };
  };

  // Fuente "csv": archivo subido por Capital Humano.
  const importarCsv = (actor, archivo, opciones = {}) =>
    aplicar(actor, analizarArchivoCsv(archivo?.buffer), { ...opciones, fuente: "csv", nombreArchivo: archivo?.originalname || "padron.csv" });

  // Fuentes remotas (CiDiTuc, Portal del Empleado): el servidor pide los datos y los aplica.
  const sincronizar = async (actor, fuente, opciones = {}) =>
    aplicar(actor, await fuente.obtener(), { ...opciones, fuente: fuente.id, nombreArchivo: fuente.nombre });

  return { importarCsv, sincronizar, aplicar, listarImportaciones, buscar, vincular, resolverLegajo, plantilla: () => PLANTILLA };
}

module.exports = { crearServicioPadron, textoBusqueda };
