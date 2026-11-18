// CiDiTuc abre el portal con el token en la URL (?auth=...), antes o después del "#".
// Se lee una sola vez, se borra de la URL de inmediato (historial, Referer, capturas)
// y queda solo en memoria hasta canjearlo por la sesión del portal.
export function extraerTokenIngreso(ventana = window) {
  const url = new URL(ventana.location.href);
  let token = url.searchParams.get("auth");
  url.searchParams.delete("auth");

  const [rutaHash, consultaHash] = url.hash.split("?");
  let hash = url.hash;
  if (consultaHash !== undefined) {
    const params = new URLSearchParams(consultaHash);
    token = token || params.get("auth");
    params.delete("auth");
    const resto = params.toString();
    hash = resto ? `${rutaHash}?${resto}` : rutaHash;
  }

  if (token) {
    url.hash = hash;
    ventana.history.replaceState(null, "", url.toString());
  }
  return token || null;
}
