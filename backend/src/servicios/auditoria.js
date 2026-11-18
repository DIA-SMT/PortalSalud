// Registro de auditoría append-only. Nunca guardar contenido clínico en `detalle`.
async function registrarAuditoria(dbAdmin, evento) {
  const { actor, accion, recurso, id_persona_titular, resultado, detalle, ip } = evento;
  try {
    await dbAdmin("auditoria_salud").insert({
      fecha: new Date(),
      id_persona_actor: actor?.id_persona ?? null,
      roles_actor: actor?.roles ? actor.roles.map((r) => r.rol).join(",").slice(0, 160) : null,
      accion,
      recurso,
      id_persona_titular: id_persona_titular ?? null,
      resultado,
      detalle: detalle ? String(detalle).slice(0, 400) : null,
      ip: ip ? String(ip).slice(0, 64) : null,
    });
  } catch (error) {
    // La auditoría no debe tumbar la respuesta, pero el fallo tiene que verse en los logs.
    console.error("[auditoria] no se pudo registrar el evento:", accion, recurso, error.message);
  }
}

module.exports = { registrarAuditoria };
