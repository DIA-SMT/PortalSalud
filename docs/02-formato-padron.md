# Padrón de empleados — formato del archivo de RRHH

> La importación por CSV es el mecanismo **provisorio**. Lo previsto es que los datos vengan del Portal del Empleado y de CiDiTuc: ver [integración futura](03-integracion-fuentes.md).

Capital Humano importa el padrón desde **Gestión → Padrón de empleados → Importar padrón**. Hace falta el rol `RECURSOS_HUMANOS` con alcance a todas las reparticiones. La plantilla se descarga desde el botón **Plantilla CSV**.

## Archivo

- Formato **CSV**. En Excel: *Archivo → Guardar como → CSV (delimitado por comas)*. Se aceptan `;` y `,` como separador, y codificación UTF-8 o ANSI (la que usa Excel en Windows).
- Primera fila: encabezados. El orden de las columnas no importa.
- Hasta 20.000 filas y 2 MB.

| Columna | Obligatoria | Detalle |
|---|---|---|
| `legajo` | Sí | Número de legajo municipal. Es la clave: con este dato se vincula al empleado cuando ingresa desde Ciudad Digital. |
| `cuil` | Sí | 11 dígitos, con o sin guiones. Se valida el dígito verificador. |
| `apellido` | Sí | |
| `nombre` | Sí | |
| `reparticion` | No | Nombre de la repartición (también se acepta `dependencia`). |
| `id_reparticion` | No | Id de la repartición en CiDiTuc. Se usa para el ámbito de los roles. Si falta, se completa en el primer ingreso del empleado. |
| `area` | No | Se carga en la ficha como "Cargado por Capital Humano". |
| `puesto` | No | Ídem (también se acepta `cargo`). |
| `actividad` | No | Ídem (también se acepta `tareas`). |

## Cómo se aplica

1. **Revisar archivo**: el portal muestra cuántas altas, actualizaciones, filas sin cambios y bajas hay, y la lista de filas con error, con su número de línea y el motivo. Todavía no se guarda nada.
2. **Confirmar importación**: se guardan las filas válidas. Las filas con error se omiten y se pueden corregir y volver a subir.
3. **Padrón completo** (opcional): si se marca, los empleados que no figuran en el archivo pasan a **inactivos**. No se borra nada.
4. Si una fila trae área, puesto o actividad y el empleado tiene una **corrección pendiente** en ese campo, ese campo no se pisa; la corrección se resuelve desde la bandeja.

## Empleados que todavía no ingresaron

Capital Humano puede cargarles datos igual: quedan con un identificador provisorio. Cuando la persona ingresa por primera vez desde Ciudad Digital, el portal la reconoce por su legajo y le asocia todo lo cargado.

Requisito: el legajo del archivo tiene que ser el mismo que CiDiTuc devuelve como `afiliado`.
