import axiosOriginal from "axios";

// Instancia del backend del Portal de Salud (mismo patrón que src/config/ del derivador).
// La sesión viaja en una cookie httpOnly: no se maneja ningún token en el navegador.
// El encabezado X-Portal-Salud es la protección anti-CSRF que exige la API.
const axiosSalud = axiosOriginal.create({
  baseURL: import.meta.env.VITE_APP_RUTA_BACK_SALUD || "/api",
  withCredentials: true,
  timeout: 15000,
  headers: { "X-Portal-Salud": "1" },
});

export const mensajeDeError = (error) =>
  error?.response?.data?.message ||
  (error?.code === "ECONNABORTED"
    ? "La solicitud tardó demasiado. Revisá tu conexión e intentá de nuevo."
    : "No pudimos conectarnos con el portal. Intentá de nuevo en unos minutos.");

export default axiosSalud;
