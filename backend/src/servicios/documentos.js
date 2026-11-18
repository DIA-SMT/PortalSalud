const CustomError = require("../utils/CustomError");
const { aISO } = require("../utils/fechas");
const { validarArchivo } = require("./validacionArchivos");

// Tipos de documento que puede subir el empleado y en qué esquema se guardan.
// Estudios, informes y certificados médicos son clínicos; las constancias son administrativas.
const TIPOS_DOCUMENTO = {
  estudio: { clasificacion: "clinico", texto: "Estudio" },
  informe: { clasificacion: "clinico", texto: "Informe" },
  certificado: { clasificacion: "clinico", texto: "Certificado médico" },
  constancia: { clasificacion: "administrativo", texto: "Constancia" },
};

// Identificador público: "a-12" (administrativo) o "c-5" (clínico).
const parsearId = (valor) => {
  const m = /^([ac])-(\d{1,10})$/.exec(String(valor));
  if (!m) throw new CustomError("Documento no encontrado", 404);
  return { clasificacion: m[1] === "a" ? "administrativo" : "clinico", id: Number(m[2]) };
};

function crearServicioDocumentos({ admin, clinica }, cifrador, almacenamiento) {
  const tablaDe = (clasificacion) =>
    clasificacion === "clinico" ? clinica("documento_clinico") : admin("documento_salud");

  const mapear = (d, clasificacion, idPersona) => {
    const subidoPorTitular = d.subido_por === idPersona;
    return {
      id: `${clasificacion === "clinico" ? "c" : "a"}-${d.id}`,
      clasificacion,
      tipo: d.tipo,
      titulo: clasificacion === "clinico" ? cifrador.descifrar(d.titulo_cif) : d.titulo,
      nombreOriginal: d.nombre_original,
      mime: d.mime,
      tamano: d.tamano,
      estadoValidacion: d.estado_validacion,
      subidoPorTitular,
      idControl: d.id_control ?? null,
      // Se puede retirar lo que subió el propio empleado mientras nadie lo validó.
      eliminable: subidoPorTitular && d.estado_validacion === "pendiente",
      creadoEn: aISO(d.creado_en),
      validadoEn: aISO(d.validado_en),
    };
  };

  const listar = async (idPersona) => {
    const [administrativos, clinicos] = await Promise.all([
      admin("documento_salud").where({ id_persona: idPersona }),
      clinica("documento_clinico").where({ id_persona: idPersona }),
    ]);
    return [
      ...administrativos.map((d) => mapear(d, "administrativo", idPersona)),
      ...clinicos.map((d) => mapear(d, "clinico", idPersona)),
    ].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
  };

  const obtenerFila = async (idPersona, idPublico) => {
    const { clasificacion, id } = parsearId(idPublico);
    const fila = await tablaDe(clasificacion).where({ id, id_persona: idPersona }).first();
    if (!fila) throw new CustomError("Documento no encontrado", 404);
    return { fila, clasificacion };
  };

  const subir = async (idPersona, { archivo, tipo, titulo, idControl }, ahora = new Date()) => {
    const definicion = TIPOS_DOCUMENTO[tipo];
    if (!definicion) throw new CustomError("Tipo de documento inválido", 400);
    const { mime, nombre, tamano } = validarArchivo(archivo);

    if (idControl) {
      const control = await admin("control_medico").where({ id: idControl, id_persona: idPersona }).first("id");
      if (!control) throw new CustomError("El control indicado no existe.", 404);
    }

    const { ruta, sha256 } = await almacenamiento.guardar(archivo.buffer);
    const comunes = {
      id_persona: idPersona,
      tipo,
      nombre_original: nombre,
      mime,
      tamano,
      ruta_almacenamiento: ruta,
      sha256,
      estado_validacion: "pendiente",
      subido_por: idPersona,
      creado_en: ahora,
    };
    try {
      const fila =
        definicion.clasificacion === "clinico"
          ? { ...comunes, titulo_cif: cifrador.cifrar(titulo.trim()) }
          : { ...comunes, titulo: titulo.trim(), id_control: idControl || null };
      const [id] = await tablaDe(definicion.clasificacion)
        .insert(fila)
        .returning("id")
        .then((r) => r.map((x) => (typeof x === "object" ? x.id : x)));
      const guardado = await tablaDe(definicion.clasificacion).where({ id }).first();
      return mapear(guardado, definicion.clasificacion, idPersona);
    } catch (error) {
      await almacenamiento.eliminar(ruta); // sin registro, no se deja el archivo huérfano
      throw error;
    }
  };

  const descargar = async (idPersona, idPublico) => {
    const { fila, clasificacion } = await obtenerFila(idPersona, idPublico);
    const contenido = await almacenamiento.leer(fila.ruta_almacenamiento);
    return { contenido, mime: fila.mime, nombre: fila.nombre_original, clasificacion };
  };

  const eliminar = async (idPersona, idPublico) => {
    const { fila, clasificacion } = await obtenerFila(idPersona, idPublico);
    if (fila.subido_por !== idPersona || fila.estado_validacion !== "pendiente") {
      throw new CustomError("Solo podés retirar documentos que subiste y que todavía no fueron validados.", 409);
    }
    await tablaDe(clasificacion).where({ id: fila.id }).del();
    await almacenamiento.eliminar(fila.ruta_almacenamiento);
    return { clasificacion };
  };

  return { listar, subir, descargar, eliminar, parsearId };
}

module.exports = { crearServicioDocumentos, TIPOS_DOCUMENTO };
