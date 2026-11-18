# Portal Integral de Salud del Empleado — Diagnóstico de integración (Fase 1)

> Fecha: 18/11/2026 (rev. 2). Repos auditados **solo lectura** (clones en `_referencia/`, no se modifican):
> `ditec-desarrollo/derivador` @ `9ceca63` · `ditec-desarrollo/ux-ui` (guía de diseño) · `ditec-desarrollo/cidituc-backend` @ `9b77eb6`.
> Alcance: **primera etapa como sistema independiente**, diseñado para integrarse al derivador (CiDiTuc) si aprueba las pruebas.

---

## 1. Resumen ejecutivo

- **Frontend de referencia**: el derivador es una SPA React 18 + Vite 5 + MUI 5 (+ Bootstrap). **La fuente oficial de estilo es `ux-ui`**, con plantillas listas (`plantillas/ciudad-digital`) más nuevas que las copias del derivador. El portal parte de esas plantillas.
- **Backend de referencia**: `cidituc-backend` es Node + Express 4 con `mysql2`/Sequelize sobre **MySQL** (datos de persona, empleado, repartición y permisos), más SQL Server (incluida una base **Sanidad**), PostgreSQL y FTP/SFTP.
- **Integración ya resuelta por el ecosistema**: las apps internas no tienen login propio. Reciben el token de CiDiTuc (`?auth=`) y lo validan contra el backend. Existe **`GET /usuarios/authStatusIA`**, que con el token devuelve **empleado + persona + repartición** (o 401 "no es empleado"). Es exactamente lo que el portal necesita para identificar al empleado sin duplicar datos.
- **Datos laborales**: hay tabla `empleado` (`id_empleado`, `id_persona`, `afiliado` = legajo, `id_reparticion`, `habilita`, `convenio`) y `reparticion`. El legajo se obtiene de un servicio municipal externo (`tarea: legajo_municipal`). **No hay área ni puesto** en lo auditado.
- **Ya existen datos y procesos de salud en el ecosistema** (Carnet de Sanidad, `ficha_medica`, `revision_medica_ledesma`, `asistencia_publica`). El portal no los consume en el MVP.

## 2. Stack y decisiones

| Capa | Ecosistema actual | Portal de Salud (etapa independiente) |
|---|---|---|
| Frontend | React 18.2 + Vite 5, JSX | Igual |
| UI | MUI 5 + Bootstrap 5 como base (según `ux-ui`) | **Plantillas `ux-ui/plantillas/ciudad-digital`**: MUI 5, Bootstrap 5, `alerta.js` (sweetalert2 estilizado). Sin styled-components |
| Estado | Zustand | Zustand (`useSaludStore`) |
| Routing | `HashRouter` | `HashRouter`, rutas bajo `/salud/*` (merge futuro sin conflictos) |
| HTTP | Una instancia de axios por servicio | `config/axiosSalud.js` |
| Backend | Node + Express 4, mysql2/Sequelize, express-validator, multer, file-type, jsonwebtoken | **Node + Express 4 con las mismas librerías base** (es el stack que el equipo mantiene) |
| BD | MySQL (persona/empleado/permisos) | **MySQL** en el piloto (esquemas propios, ver §9). Acceso con **Knex** (migraciones versionadas y portabilidad); en desarrollo y tests, **SQLite** (`better-sqlite3`), porque el equipo de desarrollo local no tiene MySQL |
| Calidad | ESLint `--max-warnings 0`; **sin tests** en ningún repo | Mismo ESLint + **Vitest/Testing Library** (front) y **Vitest/Jest + Supertest** (API). Se justifica porque el prompt exige QA de permisos y del acceso horizontal |

## 3. Convenciones a respetar

- Todo en **español** (código, rutas, textos, entidades).
- Front: `src/pages/` (pantallas), `src/components/<Dominio>/` (Panel/Tabla/Modal), `src/common/` (Layout, NavBar, SideBar, `marca.js`, `alerta.js`), `src/helpers`, `src/hooks`, `src/theme`, `src/styles`.
- Back: `routes/` → `middlewares/` → `controllers/` y `config/` por conexión, con errores `CustomError` y validación con `express-validator`. En el portal agregamos una capa de **servicios/políticas** para no meter autorización en los controladores.
- Reglas de `ux-ui`: **nunca colores sueltos** (solo `var(--cd-*)` o la paleta MUI); botones MUI y no `btn` de Bootstrap; alertas con `common/alerta.js` y borrados con `confirmarBorrado()`; carga con `Skeleton`, no spinners; `ocultarAlImprimir`; PDFs con `logo-smt.png`.
- Checklist de cierre: `ux-ui/guia/checklist-revision.md` (claro/oscuro, 390 px, impresión, alertas sobre modales).

## 4. Identidad visual

Fuente oficial: `ux-ui/guia/sistema-de-diseno.md`.

- **Azul principal de interfaz `#1f89f6`** (hover/texto de marca `#0b63c9`). Según la guía, está a mitad de camino entre los dos azules del logo.
- **Colores del logo** (confirmados por la guía y por el conteo de píxeles): hojas `#0066FF` y `#2EB1FF`, sol `#F4DC00`.
- Fondo `#f4f6fb`, superficie `#fff`, texto `#0f172a/#475569/#94a3b8`. Radios 20/14/10, sombras `sm/md/modal`, **Poppins** 300–700, header de vidrio de 64 px, modo día/noche compartido con CiDiTuc (`localStorage["tema"]`).
- Marca del header (`marca.js`): propuesta **`SALUD` / `Empleado`**, a confirmar.

Decisiones y observaciones:
1. Los archivos de tema y tokens se copian **sin modificar** desde `ux-ui`. Los tokens nuevos van en un archivo aparte (`styles/salud.css`).
2. **Amarillo institucional**: la guía no lo usa en la interfaz. Propuesta: token `--cd-amarillo: #F4DC00` solo para destacar (indicador de "próximo control", punto de novedad), **siempre con texto oscuro** (12,9:1). Sobre blanco solo da 1,4:1, así que no sirve como texto. Conviene consultarlo con quienes mantienen `ux-ui`, porque sería un token nuevo del sistema.
3. **Accesibilidad**: en el portal, links y texto en azul usan `#0b63c9` (`--cd-accent-fuerte`, 5,8:1 sobre blanco) para cumplir WCAG AA. El botón primario se mantiene como en el resto de la línea.
4. El sistema es *desktop-first* (`max-width`). El portal se escribe **mobile-first** respetando los mismos breakpoints (600/900).

## 5. Autenticación, empleados y roles

**Cómo funciona hoy (backend):**
- `POST /usuarios/login` firma un JWT `{ id: id_persona }` con secreto compartido (HS256, `JWT_SECRET_KEY`) y **vencimiento de 24 h**. No hay revocación: el logout solo borra el token del cliente.
- El middleware `auth` lee `Authorization` (token crudo, sin `Bearer`) y deja `req.id = id_persona`.
- `GET /usuarios/authStatus` devuelve la persona. `GET /usuarios/authStatusIA` devuelve **empleado + persona + repartición**, o 401 si no es empleado.
- Roles: `persona.id_tusuario` (por ejemplo, 1 = admin, 3 = vecino; cuando valida como empleado se asigna 4) más `permiso_persona` / `permiso_tusuario` por `id_proceso`. `verifyRole` solo distingue "ADMINISTRADOR".

**Propuesta para el portal:**
1. El portal recibe `?auth=<token>` desde CiDiTuc (permiso con `sistema_externo`), lo saca de la URL antes del primer render y lo envía **una sola vez** a su propio backend.
2. El backend del portal llama **servidor a servidor** a `authStatusIA`. Así confirma la identidad (`id_persona`) y que es empleado, y obtiene la repartición. No hace falta compartir el secreto JWT.
3. Emite una **sesión propia** (cookie `httpOnly; Secure; SameSite=Strict`, vencimiento corto con renovación por actividad). El token de CiDiTuc no se guarda en el navegador.
4. Los **5 roles del portal** se guardan en una tabla propia (`asignacion_rol_salud`: `id_persona`, rol, ámbito = repartición/servicio, vigencia, quién la otorgó). No se mapean a `id_tusuario`. Para la integración futura, el acceso al menú se refleja como un permiso (`id_proceso`) en CiDiTuc.
5. Toda autorización se aplica en el backend. El titular siempre sale de la **sesión**, nunca de un parámetro, para evitar el acceso horizontal.

## 6. Puntos de integración

| Punto | Etapa independiente | Integración futura |
|---|---|---|
| Acceso | Permiso "Mi Salud" con `sistema_externo` → URL del portal con `?auth=` (mismo mecanismo que el Portal del Empleado) | Ruta interna `/#/salud/*` + acceso directo en `seccionesHome.js` |
| Identidad / empleado | `authStatusIA` servidor a servidor | Igual |
| Datos personales | Lectura desde `persona` vía SSO; **no se copian** salvo contacto propio del portal | Igual |
| Legajo / repartición | `empleado.afiliado` y `reparticion` vía `authStatusIA` | Igual |
| Área / puesto / actividad | **No disponibles** → carga manual por RRHH en el portal, o integración con el servicio de legajo (§9) | — |
| Auditoría de entrada | `registrarAccesoExterno` ya registra la apertura desde CiDiTuc | Igual |
| Carnet de Sanidad | Sin integración en el MVP (§9) | A definir |

## 7. Principios de seguridad del portal

- La sesión del portal vive en una cookie `httpOnly; Secure; SameSite=Strict`. El token de CiDiTuc no se persiste en el navegador y se saca de la URL antes del primer render.
- Toda autorización se aplica en el backend. El frontend solo oculta lo que el usuario no puede usar.
- El titular de los datos sale siempre de la sesión, nunca de un parámetro.
- Sin credenciales en el código: todo por variables de entorno validadas al arrancar.
- Nunca se registran tokens ni datos clínicos en los logs.
- Consultas siempre parametrizadas y conexiones a la BD con TLS en el piloto.

## 8. Arquitectura propuesta (etapa independiente)

```
PortalSalud/
├─ frontend/   React 18 + Vite 5 + plantillas ux-ui (MUI 5 + Bootstrap 5), Zustand, HashRouter /salud/*
├─ backend/    Node + Express 4 + mysql2, express-validator, multer + file-type
│   routes → middlewares (sesión, csrf, rate-limit) → políticas de acceso → servicios → repositorios
│   módulos: sesion, ficha, contactos, controles, recordatorios, documentos, auditoria, roles
├─ docs/
└─ _referencia/   (clones de solo lectura, fuera del build)
```

- **Separación lógica**: esquema `salud_admin` (agenda, turnos, estados, recordatorios, preferencias, constancias, campañas, roles) y `salud_clinica` (declaraciones, alergias, antecedentes, medicación, detalle de aptitud, documentos clínicos), con **usuarios de BD distintos**. Las rutas de RRHH solo usan la conexión `salud_admin`.
- **Cifrado**: TLS de punta a punta (también hacia la BD); campos clínicos cifrados a nivel de aplicación (AES-256-GCM, clave fuera de la BD); documentos cifrados en almacenamiento privado fuera del webroot y servidos solo por un endpoint autorizado. Validación por *magic bytes* (`file-type`), tamaño y tipo permitido.
- **Auditoría** *append-only* de toda lectura o escritura clínica, exportaciones y cambios de rol.
- **Políticas**: `puede(sesion, accion, recurso, contexto)` centralizado y con pruebas por rol.
- **IA (Etapa 3)**: capa de "herramientas" que solo expone endpoints administrativos; los clínicos quedan fuera hasta tener autorización expresa.
- **Modo desarrollo**: un simulador de SSO con personas ficticias, para no depender de CiDiTuc ni tocar datos reales.

### Modelo de datos (español; mapeo al prompt)
| Prompt | Propuesta | Esquema |
|---|---|---|
| EmployeeHealthProfile | `ficha_salud` (FK lógica `id_persona`) | clínica |
| EmergencyContact | `contacto_emergencia` | admin |
| HealthDeclaration | `declaracion_salud` (origen: autodeclarado / verificado / profesional) | clínica |
| OccupationalRisk | `riesgo_ocupacional` | admin* |
| MedicalControl | `control_medico` (programado, pendiente, realizado, reprogramado, vencido, cancelado) | admin |
| MedicalAppointment | `turno_control` | admin |
| HealthDocument | `documento_salud` (clasificación admin/clínica, estado de validación) | según tipo |
| Reminder | `recordatorio` | admin |
| NotificationPreference | `preferencia_notificacion` (+ consentimiento por canal) | admin |
| OccupationalFitnessRecord | `registro_aptitud` (resultado comunicable en admin; detalle en clínica) | ambos |
| HealthAccessGrant | `asignacion_rol_salud` | admin |
| HealthAuditLog | `auditoria_salud` | separado |

\* A validar si los riesgos ocupacionales se consideran dato sensible. `id_persona` es una FK **lógica**: la tabla `persona` vive en otra base y no se crean claves foráneas entre bases.

## 9. Decisiones pendientes (no asumidas)

1. ~~Acceso a `cidituc-backend` y `ux-ui`~~ ✔ resuelto.
2. **Llamada servidor a servidor a `authStatusIA`**: ¿el backend del portal puede llegar en red al backend de CiDiTuc? ¿Hay una URL de pruebas? (Alternativa: compartir `JWT_SECRET_KEY`. No es lo recomendado.)
3. **Área, puesto y actividad laboral**: ¿el servicio `legajo_municipal` los expone? ¿Con qué campos y con qué autorización?
4. **Carnet de Sanidad y procesos existentes** (`ficha_medica`, `revision_medica_ledesma`, `asistencia_publica`): ¿el portal los reemplaza, los enlaza o convive con ellos? ¿Se pueden reutilizar datos del carnet? (Primero hay que definir la base legal y la finalidad: el carnet tiene otro propósito.)
5. **Base de datos del piloto**: ¿un servidor MySQL aislado o esquemas nuevos en el servidor existente?
6. **Organización de salud laboral**: ¿existe un servicio de Medicina Laboral o de Reconocimientos Médicos? ¿Quiénes serían PROFESIONAL_SALUD y COORDINADOR_SALUD? ¿Interviene una ART?
7. **Marco legal (Asesoría Legal)**: Ley 25.326 (los datos de salud son sensibles), Ley 26.529 (derechos del paciente e historia clínica), Ley 19.587 y Dec. 351/79, Ley 24.557 y normativa de la SRT sobre exámenes, y el régimen de empleo público provincial/municipal. Definir la base del tratamiento, los consentimientos, los plazos de conservación y qué ve RRHH de la aptitud.
8. **Canales externos** (email/WhatsApp): proveedor y consentimiento. El backend ya usa `nodemailer`; WhatsApp no está.
9. **Hosting y dominio** del piloto (por ejemplo `salud.smt.gob.ar`) y almacenamiento de documentos.
10. **Marca del header**: `SALUD / Empleado` u otra.
11. **Capital Humano y datos de salud** (decidido el 18/11/2026, a validar con Asesoría Legal): Capital Humano carga la información de salud. Se implementó con un rol separado, `CAPITAL_HUMANO_SALUD`, asignado a personas puntuales y auditado, para que el resto de `RECURSOS_HUMANOS` siga sin acceso a datos clínicos.
12. **Origen de los datos de empleados**: van a salir de CiDiTuc y del Portal del Empleado. La estructura quedó lista ([integración futura](03-integracion-fuentes.md)), y mientras tanto se importan por CSV ([formato](02-formato-padron.md)). Falta acordar con esos equipos un endpoint de servicio y confirmar que el legajo coincide con el `afiliado` de CiDiTuc.

## Decisiones tomadas

- **Quién carga la ficha** (18/11/2026): Capital Humano carga datos personales y de contacto, información laboral (área, puesto y actividad) e información de salud. El empleado carga sus contactos de emergencia.
- **Correcciones del empleado**: puede corregir cualquier dato de su ficha. El cambio se aplica al instante, queda marcado como "pendiente de revisión" y entra en una bandeja del área responsable, que lo marca como revisado o restaura el valor anterior. Si se restaura, el empleado recibe un aviso en el portal sin el detalle del dato.
- **Aviso a los responsables**: bandeja en el portal con contador. Sin correo por ahora.
- **Quién revisa**: las correcciones administrativas, `RECURSOS_HUMANOS`; las de salud, `CAPITAL_HUMANO_SALUD` o `PROFESIONAL_SALUD`, cada uno dentro de su ámbito. Nadie revisa correcciones de su propia ficha.


## 10. Plan de implementación — Etapa 1 (MVP)

| Paso | Entregable |
|---|---|
| 0 | Resolver §9.2, 9.5 y 9.6 (bloquean la arquitectura) |
| 1 | Monorepo, plantillas `ux-ui` (tema, tokens, NavBar, SideBar, alerta, esqueletos), `marca.js`, ESLint, Vitest |
| 2 | Backend: sesión SSO + simulador de desarrollo, políticas, auditoría, migraciones y seed ficticio |
| 3 | Dashboard "Mi Salud" + Ficha (pestañas) + contactos de emergencia |
| 4 | Controles médicos (listado + calendario, estados) |
| 5 | Recordatorios internos + preferencias + confirmación de lectura |
| 6 | Historial y documentos (subida validada, almacenamiento privado, descarga) |
| 7 | Asignación de roles + QA: permisos por rol, acceso horizontal, accesibilidad, 390 px, checklist `ux-ui` |
| 8 | Alta del permiso "Mi Salud" en el entorno de prueba de CiDiTuc y piloto |

Las Etapas 2 (salud laboral) y 3 (IA e integraciones) se detallan al cerrar el MVP.
