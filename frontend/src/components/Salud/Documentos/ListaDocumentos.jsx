/* eslint-disable react/prop-types */
import { useState } from "react";
import { Chip, CircularProgress, IconButton, Tooltip } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { ValidacionChip } from "../Ficha/Comunes";
import { TIPOS_DOCUMENTO, descargarDocumento, formatearTamano } from "../../../helpers/documentos";
import { avisarError } from "../../../helpers/avisos";

const formatoFecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });

// Lista de documentos propios con descarga y retiro (cuando corresponde).
const ListaDocumentos = ({ documentos, onRetirar }) => {
  const [descargando, setDescargando] = useState(null);

  const descargar = async (d) => {
    setDescargando(d.id);
    try {
      await descargarDocumento(d);
    } catch (error) {
      avisarError(error.message);
    }
    setDescargando(null);
  };

  return (
    <ul className="ps-lista">
      {documentos.map((d) => (
        <li className="ps-lista__item ps-documento" key={d.id}>
          <span className="ps-documento__icono" aria-hidden="true">
            {d.mime?.startsWith("image/") ? <ImageOutlinedIcon /> : <DescriptionOutlinedIcon />}
          </span>
          <span className="ps-lista__textos ps-documento__textos">
            <span className="ps-lista__principal">{d.titulo}</span>
            <span className="ps-lista__secundario">
              {TIPOS_DOCUMENTO[d.tipo]?.texto || d.tipo} · {formatoFecha.format(new Date(d.creadoEn))}
              {d.tamano ? ` · ${formatearTamano(d.tamano)}` : ""}
              {d.subidoPorTitular ? " · Subido por vos" : " · Servicio de salud"}
            </span>
            <span className="d-flex flex-wrap gap-1 mt-1">
              {d.clasificacion === "clinico" && (
                <Chip size="small" label="Confidencial" sx={{ bgcolor: "var(--cd-violeta-bg)", color: "var(--cd-text)" }} />
              )}
              <ValidacionChip estado={d.estadoValidacion} />
            </span>
          </span>
          <span className="cd-acciones">
            <Tooltip title="Descargar">
              <span>
                <IconButton
                  aria-label={`Descargar ${d.titulo}`}
                  onClick={() => descargar(d)}
                  disabled={descargando === d.id}
                >
                  {descargando === d.id ? <CircularProgress size={18} /> : <FileDownloadOutlinedIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            {d.eliminable && onRetirar && (
              <Tooltip title="Retirar">
                <IconButton aria-label={`Retirar ${d.titulo}`} onClick={() => onRetirar(d)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default ListaDocumentos;
