const CustomError = require("../utils/CustomError");
const { aISO } = require("../utils/fechas");
const { puede, ROLES } = require("../politicas/politicas");

const ETIQUETAS = {
  telefono_alternativo: "Teléfono alternativo",
  email_alternativo: "Correo alternativo",
  area: "Área",
  puesto: "Puesto",
  actividad: "Actividad laboral",
  grupo_sanguineo: "Grupo sanguíneo",
  cobertura: "Cobertura de salud",
};
const CATEGORIAS = { alergia: "Alergia", antecedente: "Antecedente", condicion: "Condición relevante", medicacion: "Medicación" };
const SECCIONES = { contacto: "Medios de contacto", laboral: "Información laboral", salud: "Información de salud" };

const DESTINO_RECORDATORIO = { contacto: "Datos personales", laboral: "Información laboral", salud: "Información de salud" };

// Reparticiones que alcanza el actor con alguno de los roles (null = todas).
const ambitos = (actor, roles) => {
  const propios = actor.roles.filter((r) => roles.includes(r.rol));
  if (!propios.length) return [];
  if (propios.some((r) => (r.ambito_id_reparticion ?? null) === null)) return null;
  return propios.map((r) => r.ambito_id_reparticion);
};

const filtrarAmbito = (consulta, lista) => (lista === null ? consulta : consulta.whereIn("id_reparticion", lista));

// Bandeja de correcciones que hacen los empleados sobre su ficha. Las administrativas
// las revisa Recursos Humanos; las de salud, Capital Humano (salud) o el servicio de salud.
function crearServicioCorrecciones({ admin, clinica }, cifrador) {
  const descifrar = (v) => (v === null || v === undefined ? null : cifrador.descifrar(v));

  const rolesAdmin = [ROLES.RECURSOS_HUMANOS];
  const rolesClinicos = [ROLES.CAPITAL_HUMANO_SALUD, ROLES.PROFESIONAL_SALUD];

  const mapearAdmin = (c) => ({
    id: `a-${c.id}`,
    tipo: "administrativa",
    seccion: SECCIONES[c.seccion],
    campo: ETIQUETAS[c.campo] || c.campo,
    accion: "modificar",
    valorAnterior: c.valor_anterior,
    valorNuevo: c.valor_nuevo,
    ...comunes(c),
  });

  const mapearClinica = (c) => ({
    id: `c-${c.id}`,
    tipo: "clinica",
    seccion: SECCIONES.salud,
    campo: c.campo === "declaracion" ? CATEGORIAS[c.categoria] || "Dato de salud" : ETIQUETAS[c.campo],
    accion: c.accion,
    valorAnterior: descifrar(c.valor_anterior_cif),
    valorNuevo: descifrar(c.valor_nuevo_cif),
    ...comunes(c),
  });

  function comunes(c) {
    return {
      persona: { nombre: c.persona_nombre, legajo: c.persona_legajo, reparticion: c.reparticion },
      estado: c.estado,
      creadoEn: aISO(c.creado_en),
      actualizadoEn: aISO(c.actualizado_en),
      revisadoEn: aISO(c.revisado_en),
      nota: c.nota,
    };
  }

  const listar = async (actor, { soloPendientes = true } = {}) => {
    const ambAdmin = ambitos(actor, rolesAdmin);
    const ambClinico = ambitos(actor, rolesClinicos);
    if (ambAdmin?.length === 0 && ambClinico?.length === 0) {
      throw new CustomError("No tenés permiso para revisar correcciones.", 403);
    }
    const consulta = (db, tabla, amb) => {
      if (amb?.length === 0) return Promise.resolve([]);
      let q = db(tabla).whereNot({ id_persona: actor.id_persona }); // nadie revisa lo propio
      if (soloPendientes) q = q.where({ estado: "pendiente" });
      return filtrarAmbito(q, amb).orderBy("actualizado_en", "desc").limit(200);
    };
    const [administrativas, clinicas] = await Promise.all([
      consulta(admin, "correccion_ficha", ambAdmin),
      consulta(clinica, "correccion_clinica", ambClinico),
    ]);
    return {
      correcciones: [...administrativas.map(mapearAdmin), ...clinicas.map(mapearClinica)].sort((a, b) =>
        String(b.actualizadoEn).localeCompare(String(a.actualizadoEn))
      ),
      puedeRevisar: { administrativas: ambAdmin?.length !== 0, clinicas: ambClinico?.length !== 0 },
    };
  };

  const contarPendientes = async (actor) => {
    const contar = async (db, tabla, amb) => {
      if (amb?.length === 0) return 0;
      const q = filtrarAmbito(db(tabla).where({ estado: "pendiente" }).whereNot({ id_persona: actor.id_persona }), amb);
      const fila = await q.count({ cantidad: "*" }).first();
      return Number(fila?.cantidad || 0);
    };
    const [a, c] = await Promise.all([
      contar(admin, "correccion_ficha", ambitos(actor, rolesAdmin)),
      contar(clinica, "correccion_clinica", ambitos(actor, rolesClinicos)),
    ]);
    return a + c;
  };

  // Revertir: devuelve el dato al valor anterior a la corrección del empleado.
  const revertirAdmin = async (c, ahora) => {
    const tabla = c.seccion === "contacto" ? "datos_contacto" : "datos_laborales";
    await admin(tabla).where({ id_persona: c.id_persona }).update({ [c.campo]: c.valor_anterior, actualizado_en: ahora });
  };

  const revertirClinica = async (trx, c, ahora) => {
    if (c.campo === "grupo_sanguineo" || c.campo === "cobertura") {
      const columna = c.campo === "grupo_sanguineo" ? "grupo_sanguineo_cif" : "cobertura_cif";
      await trx("ficha_salud").where({ id_persona: c.id_persona }).update({ [columna]: c.valor_anterior_cif, actualizado_en: ahora });
      return;
    }
    const declaracion = trx("declaracion_salud").where({ id: c.id_declaracion, id_persona: c.id_persona });
    if (c.accion === "crear") await declaracion.update({ vigente: false, actualizado_en: ahora });
    else if (c.accion === "baja") await declaracion.update({ vigente: true, actualizado_en: ahora });
    else await declaracion.update({ descripcion_cif: c.valor_anterior_cif, actualizado_en: ahora });
  };

  // Aviso al empleado cuando se revierte un cambio suyo. Sin contenido clínico.
  const avisarReversion = (idPersona, seccion, ahora) =>
    admin("recordatorio").insert({
      id_persona: idPersona,
      tipo: "general",
      titulo: "Se revisó un cambio en tu ficha",
      mensaje: `El área responsable restauró un dato que habías modificado en "${DESTINO_RECORDATORIO[seccion]}". Revisalo en Mi ficha y, si tenés dudas, consultá con Capital Humano.`,
      programado_para: ahora,
      creado_en: ahora,
    });

  const resolver = async (actor, idPublico, { decision, nota }) => {
    const m = /^([ac])-(\d{1,10})$/.exec(String(idPublico));
    if (!m) throw new CustomError("Corrección no encontrada", 404);
    const esClinica = m[1] === "c";
    const id = Number(m[2]);
    const db = esClinica ? clinica : admin;
    const tabla = esClinica ? "correccion_clinica" : "correccion_ficha";

    const c = await db(tabla).where({ id }).first();
    const contexto = c && { id_persona_titular: c.id_persona, id_reparticion_titular: c.id_reparticion };
    if (!c || !puede(actor, "revisar", esClinica ? "correcciones_clinicas" : "correcciones_ficha", contexto)) {
      throw new CustomError("Corrección no encontrada", 404);
    }
    if (c.id_persona === actor.id_persona) throw new CustomError("No podés revisar correcciones de tu propia ficha.", 403);
    if (c.estado !== "pendiente") throw new CustomError("Esta corrección ya fue revisada.", 409);

    const ahora = new Date();
    const resolucion = {
      estado: decision === "revertir" ? "revertida" : "revisada",
      revisado_por: actor.id_persona,
      revisado_en: ahora,
      nota: nota ? String(nota).trim().slice(0, 300) : null,
    };

    if (esClinica) {
      await clinica.transaction(async (trx) => {
        if (decision === "revertir") await revertirClinica(trx, c, ahora);
        else if (c.campo === "grupo_sanguineo") {
          await trx("ficha_salud").where({ id_persona: c.id_persona }).update({ grupo_sanguineo_confirmado: true, grupo_sanguineo_confirmado_por: actor.id_persona });
        }
        await trx(tabla).where({ id }).update(resolucion);
      });
    } else {
      if (decision === "revertir") await revertirAdmin(c, ahora);
      await admin(tabla).where({ id }).update(resolucion);
    }

    if (decision === "revertir") await avisarReversion(c.id_persona, esClinica ? "salud" : c.seccion, ahora);
    const actualizada = await db(tabla).where({ id }).first();
    return { correccion: esClinica ? mapearClinica(actualizada) : mapearAdmin(actualizada), idPersona: c.id_persona };
  };

  return { listar, contarPendientes, resolver };
}

module.exports = { crearServicioCorrecciones };
