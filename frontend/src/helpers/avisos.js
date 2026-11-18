import Swal from "../common/alerta";

// Aviso breve de éxito (no bloquea). Usa el mixin de alerta.js con los tokens del sistema.
export const avisarExito = (titulo) =>
  Swal.fire({
    toast: true,
    position: "bottom",
    icon: "success",
    title: titulo,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });

export const avisarError = (texto) =>
  Swal.fire({ icon: "error", title: "No pudimos guardar", text: texto, confirmButtonText: "Entendido" });
