import { create } from "zustand";
import axiosSalud, { mensajeDeError } from "../config/axiosSalud";

const useSaludStore = create((set) => ({
  usuario: null,
  roles: [],
  autenticado: false,
  cargandoSesion: true,
  errorSesion: "",

  // Correcciones de fichas esperando revisión (solo personal revisor).
  pendientesRevision: 0,
  actualizarPendientesRevision: async () => {
    try {
      const { data } = await axiosSalud.get("/gestion/correcciones/pendientes");
      set({ pendientesRevision: data.cantidad });
    } catch {
      set({ pendientesRevision: 0 });
    }
  },

  // Recordatorios sin leer (campana del header).
  noLeidos: 0,
  setNoLeidos: (cantidad) => set({ noLeidos: cantidad }),
  actualizarNoLeidos: async () => {
    try {
      const { data } = await axiosSalud.get("/salud/recordatorios/no-leidos");
      set({ noLeidos: data.cantidad });
    } catch {
      // no bloquea la navegación si falla
    }
  },

  // Canjea el token de CiDiTuc por la sesión del portal (cookie httpOnly).
  iniciarSesion: async (token) => {
    set({ cargandoSesion: true, errorSesion: "" });
    try {
      await axiosSalud.post("/sesion", { token });
      const { data } = await axiosSalud.get("/sesion");
      set({ usuario: data.usuario, roles: data.roles, autenticado: true });
    } catch (error) {
      set({ autenticado: false, usuario: null, roles: [], errorSesion: mensajeDeError(error) });
    }
    set({ cargandoSesion: false });
  },

  // Recupera una sesión existente (recarga de página).
  obtenerSesion: async () => {
    set({ cargandoSesion: true, errorSesion: "" });
    try {
      const { data } = await axiosSalud.get("/sesion");
      set({ usuario: data.usuario, roles: data.roles, autenticado: true });
    } catch (error) {
      set({
        autenticado: false,
        usuario: null,
        roles: [],
        errorSesion: error?.response?.status === 401 ? "" : mensajeDeError(error),
      });
    }
    set({ cargandoSesion: false });
  },

  // Cierra la sesión del portal y vuelve a Ciudad Digital (igual que el derivador).
  cerrarSesion: async () => {
    let destino = "https://ciudaddigital.smt.gob.ar/?logout=true";
    try {
      const { data } = await axiosSalud.delete("/sesion");
      destino = data.redireccion || destino;
    } catch {
      // aunque falle, se sale del portal
    }
    set({ autenticado: false, usuario: null, roles: [] });
    window.location.assign(destino);
  },
}));

export default useSaludStore;
