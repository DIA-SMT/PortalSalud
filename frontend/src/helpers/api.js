import axiosSalud from "../config/axiosSalud";

// Guarda con un PUT y devuelve el cuerpo de la respuesta.
export const guardarCon = (url) => async (cuerpo) => (await axiosSalud.put(url, cuerpo)).data;
