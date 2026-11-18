import { useCallback, useEffect, useState } from "react";
import axiosSalud, { mensajeDeError } from "../config/axiosSalud";

// Carga un recurso de la API con estados de carga y error, y permite recargarlo.
const useCarga = (url) => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const { data } = await axiosSalud.get(url);
      setDatos(data);
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setCargando(false);
  }, [url]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, setDatos, cargando, error, recargar };
};

export default useCarga;
