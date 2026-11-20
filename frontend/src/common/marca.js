import { createElement } from "react";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { esRevisor, gestionaAgenda, veePadron } from "../helpers/roles";

// Datos de marca del Portal de Salud. En el header se ve: [isotipo] SALUD
//                                                                   Empleado
export const MARCA = {
  superior: "SALUD",
  nombre: "Empleado",
  alt: "Municipalidad de San Miguel de Tucumán",
};

// Ítems del menú lateral. Se agregan a medida que cada pantalla queda operativa.
//   visible -> (sesion) => boolean; `sesion` = { usuario, roles }
export const ITEMS_MENU = [
  { ruta: "/salud", texto: "Mi Salud", icono: createElement(FavoriteBorderRoundedIcon) },
  { ruta: "/salud/ficha", texto: "Mi ficha", icono: createElement(AssignmentIndOutlinedIcon) },
  { ruta: "/salud/controles", texto: "Mis controles", icono: createElement(EventAvailableOutlinedIcon) },
  { ruta: "/salud/recordatorios", texto: "Recordatorios", icono: createElement(NotificationsNoneRoundedIcon) },
  { ruta: "/salud/documentos", texto: "Historial y documentos", icono: createElement(FolderOpenOutlinedIcon) },
  // Personal autorizado (el backend valida el permiso y el ámbito).
  {
    ruta: "/salud/gestion/agenda",
    texto: "Agenda de controles",
    icono: createElement(CalendarMonthOutlinedIcon),
    visible: (sesion) => gestionaAgenda(sesion?.roles),
  },
  {
    ruta: "/salud/gestion/correcciones",
    texto: "Correcciones de fichas",
    icono: createElement(FactCheckOutlinedIcon),
    visible: (sesion) => esRevisor(sesion?.roles),
  },
  {
    ruta: "/salud/gestion/padron",
    texto: "Padrón de empleados",
    icono: createElement(BadgeOutlinedIcon),
    visible: (sesion) => veePadron(sesion?.roles),
  },
];
