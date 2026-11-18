const path = require("path");

const RAIZ_BACKEND = path.join(__dirname, "..", "..");

const entero = (valor, porDefecto) => {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : porDefecto;
};

const booleano = (valor, porDefecto) => {
  if (valor === undefined || valor === "") return porDefecto;
  return ["1", "true", "si", "sí"].includes(String(valor).toLowerCase());
};

const configMysql = (env, prefijo) => ({
  host: env[`${prefijo}_HOST`],
  port: entero(env[`${prefijo}_PUERTO`], 3306),
  user: env[`${prefijo}_USUARIO`],
  password: env[`${prefijo}_CLAVE`],
  database: env[`${prefijo}_NOMBRE`],
  // Las fechas calendario (DATE) se leen como texto YYYY-MM-DD, igual que en SQLite.
  dateStrings: ["DATE"],
  timezone: "Z",
  ssl: booleano(env.DB_SSL, true) ? { rejectUnauthorized: true } : undefined,
});

const archivoSqlite = (valor, porDefecto) => {
  const archivo = valor || porDefecto;
  return archivo === ":memory:" ? archivo : path.resolve(RAIZ_BACKEND, archivo);
};

// Lee y valida la configuración. Falla al arrancar ante cualquier
// combinación insegura, en vez de descubrirlo en tiempo de ejecución.
function cargarConfig(env = process.env) {
  const entorno = env.NODE_ENV || "development";
  const esProduccion = entorno === "production";
  const errores = [];

  const identidadModo = env.IDENTIDAD_MODO || "cidituc";
  if (!["cidituc", "simulado"].includes(identidadModo)) {
    errores.push("IDENTIDAD_MODO debe ser 'cidituc' o 'simulado'");
  }
  if (identidadModo === "simulado" && esProduccion) {
    errores.push("IDENTIDAD_MODO=simulado no está permitido en producción");
  }
  if (identidadModo === "cidituc" && !env.CIDITUC_API_URL) {
    errores.push("Falta CIDITUC_API_URL");
  }

  const dbCliente = env.DB_CLIENTE || "better-sqlite3";
  if (!["better-sqlite3", "mysql2"].includes(dbCliente)) {
    errores.push("DB_CLIENTE debe ser 'better-sqlite3' o 'mysql2'");
  }
  if (dbCliente === "better-sqlite3" && esProduccion) {
    errores.push("SQLite es solo para desarrollo; en producción usar mysql2");
  }

  const claveCifrado = Buffer.from(env.CLAVE_CIFRADO_CLINICA || "", "base64");
  if (claveCifrado.length !== 32) {
    errores.push("CLAVE_CIFRADO_CLINICA debe ser de 32 bytes en base64");
  }

  if (errores.length) {
    throw new Error(`Configuración inválida:\n- ${errores.join("\n- ")}`);
  }

  const cookieSegura = booleano(env.COOKIE_SEGURA, esProduccion);

  return {
    entorno,
    esProduccion,
    puerto: entero(env.PUERTO, 4010),
    origenPermitido: env.ORIGEN_PERMITIDO || "http://localhost:5180",
    identidad: {
      modo: identidadModo,
      ciditucApiUrl: (env.CIDITUC_API_URL || "").replace(/\/+$/, ""),
      ciditucLogoutUrl:
        env.CIDITUC_LOGOUT_URL || "https://ciudaddigital.smt.gob.ar/?logout=true",
      timeoutMs: entero(env.CIDITUC_TIMEOUT_MS, 5000),
    },
    sesion: {
      // El prefijo __Host- obliga a Secure, Path=/ y sin Domain.
      nombreCookie: cookieSegura ? "__Host-ps_sesion" : "ps_sesion",
      cookieSegura,
      minutosInactividad: entero(env.SESION_MINUTOS_INACTIVIDAD, 30),
      horasMaximas: entero(env.SESION_HORAS_MAXIMAS, 8),
    },
    db: {
      cliente: dbCliente,
      admin:
        dbCliente === "mysql2"
          ? configMysql(env, "DB_ADMIN")
          : { filename: archivoSqlite(env.DB_ADMIN_ARCHIVO, "datos/salud_admin.sqlite") },
      clinica:
        dbCliente === "mysql2"
          ? configMysql(env, "DB_CLINICA")
          : { filename: archivoSqlite(env.DB_CLINICA_ARCHIVO, "datos/salud_clinica.sqlite") },
    },
    claveCifrado,
    // Fuentes de datos de empleados para el padrón. Sin URL, la fuente queda deshabilitada
    // y solo funciona la importación por CSV. Ver docs/03-integracion-fuentes.md.
    fuentesEmpleados: {
      cidituc: {
        url: env.FUENTE_CIDITUC_EMPLEADOS_URL || null,
        token: env.FUENTE_CIDITUC_TOKEN || null,
        timeoutMs: entero(env.FUENTE_TIMEOUT_MS, 15000),
      },
      portalEmpleado: {
        url: env.FUENTE_PORTAL_EMPLEADO_URL || null,
        token: env.FUENTE_PORTAL_EMPLEADO_TOKEN || null,
        timeoutMs: entero(env.FUENTE_TIMEOUT_MS, 15000),
      },
    },
    // Carpeta privada (fuera de cualquier carpeta pública) para los archivos cifrados.
    documentosDir: path.resolve(RAIZ_BACKEND, env.DOCUMENTOS_DIR || "datos/documentos"),
    // [PENDIENTE] Regla organizativa: con cuántos días de anticipación se puede pedir reprogramar.
    reprogramacionDiasMinimos: entero(env.REPROGRAMACION_DIAS_MINIMOS, 2),
    // Canales externos: se habilitan recién cuando exista el servicio real.
    canalesExternos: {
      email: booleano(env.CANAL_EMAIL_HABILITADO, false),
      whatsapp: booleano(env.CANAL_WHATSAPP_HABILITADO, false),
    },
  };
}

module.exports = { cargarConfig, RAIZ_BACKEND };
