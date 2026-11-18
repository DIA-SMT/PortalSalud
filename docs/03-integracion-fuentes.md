# Integración futura con CiDiTuc y el Portal del Empleado

Los datos de los empleados van a salir de lo que ya tienen **CiDiTuc** y el **Portal del Empleado**. El portal tiene la estructura armada para conectarse a esas fuentes. Mientras no estén habilitadas, Capital Humano importa el padrón por CSV ([formato](02-formato-padron.md)), y todo pasa por el mismo motor.

> Estado: **preparado, no conectado**. Ninguno de los dos sistemas expone hoy un listado de empleados para otros sistemas. El portal no modifica ni consulta sus bases directamente.

## Cómo está armado

```
backend/src/servicios/fuentesEmpleados/
├─ registro.js        contrato: registro normalizado + validación (legajo, CUIL, nombres, repartición, laborales)
├─ csv.js             fuente "csv": archivo de RRHH → registros
├─ remota.js          base HTTP común: token de servicio, timeout, manejo de errores
├─ portalEmpleado.js  fuente "portal_empleado": mapeo del legajo municipal → registros
├─ cidituc.js         fuente "cidituc": mapeo de persona/empleado/repartición → registros
└─ index.js           registro de fuentes y origen con que se marca cada dato
backend/src/servicios/padron.js   motor común: previsualizar, confirmar, vincular, no pisar correcciones
```

Flujo, igual para todas las fuentes:

1. La fuente entrega una lista de **registros normalizados**.
2. El motor calcula altas, actualizaciones, bajas y errores (**previsualizar**).
3. Al **confirmar**, actualiza el padrón y la ficha laboral en una transacción. Los datos se marcan con el origen de la fuente ("Dato del Portal del Empleado", "Dato de Ciudad Digital", "Cargado por Capital Humano"), salvo los campos que el empleado corrigió y están pendientes de revisión.
4. Si el empleado corrige uno de esos datos, la corrección va a la bandeja de Capital Humano, igual que con cualquier otro dato.
5. Al primer ingreso, el empleado se vincula por **legajo** con lo cargado.

Endpoints (personal con `RECURSOS_HUMANOS` de alcance global):

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/gestion/padron/fuentes` | Fuentes y si están habilitadas |
| POST | `/api/gestion/padron/importaciones` | CSV (multipart): `archivo`, `confirmar`, `padronCompleto` |
| POST | `/api/gestion/padron/sincronizaciones` | Fuente remota: `{ fuente, confirmar, padronCompleto }` |
| GET | `/api/gestion/padron/importaciones` | Últimas importaciones, con su fuente |

## Registro normalizado (contrato)

```json
{
  "legajo": 70001,
  "cuil": "20111111112",
  "apellido": "Ficticia",
  "nombre": "Lucía",
  "reparticion": "Secretaría de Hacienda",
  "id_reparticion": 9101,
  "laborales": { "area": "Presupuesto", "puesto": "Analista", "actividad": "Tareas administrativas" }
}
```

- `legajo` y `cuil` (con dígito verificador válido), `apellido` y `nombre` son obligatorios.
- `id_reparticion` es el id de **CiDiTuc**: con él se aplica el ámbito de los roles. Si la fuente no lo trae, se completa en el primer ingreso del empleado.
- En `laborales` van solo los campos que la fuente informa; los que no vienen no se tocan.

## Qué haría falta de cada sistema

Para que el equipo de cada sistema lo evalúe. **No se tocaron sus repositorios.**

### Portal del Empleado (legajo municipal), fuente principal
- Un endpoint de servicio que devuelva el listado de empleados activos, un arreglo o `{ data: [...] }`.
- Campos que el adaptador ya reconoce (`portalEmpleado.js`): `lega_12`/`legajo`, `cuil`, `apellido`, `nombre`, `reparticion`/`desc_17`, `area`/`desc_area`, `puesto`/`cargo`/`desc_cargo`, `actividad`/`funcion`/`tareas`.
- Hoy CiDiTuc consulta el legajo de a uno (`tarea: "legajo_municipal"`, por CUIL) y recibe `lega_12`, `codi_17`, `calc_12` y `codi_02`. **Falta confirmar** de dónde salen el área, el puesto y la actividad.

### CiDiTuc, complementaria
- Un endpoint de servicio que devuelva los empleados validados, con los nombres de columna de su base: `afiliado`, `documento_persona`, `apellido_persona`, `nombre_persona`, `id_reparticion` y `nombre_reparticion` (tablas `empleado`, `persona` y `reparticion`).
- Aporta identificación y repartición (con el id de CiDiTuc). No tiene datos laborales.

### Para ambos
- **Autenticación servidor a servidor** con un token de servicio en el encabezado `X-Token-Servicio`. Nunca se usa el token de un usuario.
- Por **minimización**, sin domicilio, teléfono, fecha de nacimiento ni otros datos que el portal no usa.

## Habilitar una fuente

En `backend/.env`:

```
FUENTE_PORTAL_EMPLEADO_URL=https://<servicio>/empleados
FUENTE_PORTAL_EMPLEADO_TOKEN=<token de servicio>
FUENTE_CIDITUC_EMPLEADOS_URL=https://<servicio>/empleados
FUENTE_CIDITUC_TOKEN=<token de servicio>
```

Con la URL configurada, en **Padrón de empleados → Fuentes de datos** aparece el botón **Sincronizar**. Si los nombres de campo reales difieren, alcanza con ajustar la función `mapear…` del adaptador; el resto no cambia.

## Pendiente de definir

- Frecuencia: sincronización manual (como está hoy) o automática (tarea programada que llame a `padron.sincronizar`).
- Qué fuente manda si dos informan el mismo dato. Propuesta: el Portal del Empleado para lo laboral y CiDiTuc para la repartición.
- Datos de contacto (teléfono y correo) de CiDiTuc: si se integran, con qué consentimiento.
