# Portal Integral de Salud del Empleado

Municipalidad de San Miguel de Tucumán. Primera etapa como **sistema independiente**, pensado para integrarse a Ciudad Digital (CiDiTuc / derivador) si aprueba el piloto. Diagnóstico y decisiones: [docs/01-diagnostico-integracion.md](docs/01-diagnostico-integracion.md).

| Carpeta | Qué es |
|---|---|
| `frontend/` | React 18 + Vite 5 + MUI 5, plantillas oficiales `ux-ui` (estilo Ciudad Digital), Zustand, `HashRouter` bajo `/salud/*` |
| `backend/` | Node + Express 4 + Knex. MySQL en el piloto, SQLite en desarrollo y tests |
| `docs/` | Diagnóstico, arquitectura y plan |
| `_referencia/` | Clones de solo lectura de los repos de CiDiTuc (no se modifican, no se versionan) |

## Desarrollo local

Requisitos: Node 22 o superior.

```bash
npm install
```

```bash
npm run env:dev -w backend
```

```bash
npm run db:seed
```

```bash
npm run dev:back
```

```bash
npm run dev:front
```

Abrir `http://localhost:5180`. En desarrollo el backend usa **identidad simulada**: la pantalla de ingreso lista personas ficticias con distintos roles. En producción esa pantalla no existe y el backend se niega a arrancar en modo simulado.

## Calidad

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

## Cómo se ingresa (piloto)

1. En CiDiTuc se da de alta un permiso "Mi Salud" con `sistema_externo` = URL del portal. CiDiTuc lo abre con `?auth=<token>`.
2. El frontend saca el token de la URL antes del primer render y lo envía una sola vez a `POST /api/sesion`.
3. El backend lo valida servidor a servidor con `GET {CIDITUC_API_URL}/usuarios/authStatusIA` (empleado + repartición) y crea una sesión propia en una cookie `httpOnly; Secure; SameSite=Strict`.

## Datos

Solo datos **ficticios** en desarrollo y pruebas (ids desde 900000, dominio `.test`). Dos esquemas separados: `salud_admin` (operativo) y `salud_clinica` (campos cifrados con AES-256-GCM).

Los documentos se guardan cifrados en `DOCUMENTOS_DIR` (por defecto `backend/datos/documentos`), con nombres aleatorios y fuera de cualquier carpeta pública. Solo se aceptan PDF, JPG y PNG de hasta 5 MB, validados por su contenido. Los PDF con scripts o adjuntos se rechazan.
