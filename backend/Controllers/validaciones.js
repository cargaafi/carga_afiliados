// Reglas comunes a RD, RG y RC. El bloque de la persona (columnas N..AC) es
// identico en las tres hojas, asi que las validaciones, los mensajes y los
// nombres de campo viven aca y no se repiten en cada controller.
require("dotenv").config();
const mysql = require("mysql2");
const pool = mysql.createPool({ uri: process.env.DATABASE_URL }).promise();

// ---------------------------------------------------------------- texto

function norm(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// El valor puede venir como texto, numero, fecha, formula, richText o
// hyperlink (los correos suelen serlo).
function txt(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    if (Array.isArray(valor.richText))
      return valor.richText.map((r) => r.text).join("").trim();
    if (valor.text !== undefined) return String(valor.text).trim();
    if (valor.result !== undefined) return String(valor.result).trim();
    return "";
  }
  return String(valor).trim();
}

function num(valor) {
  const s = txt(valor).replace(/[^\d-]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Excel guarda CP y seccion como numero: 06700 llega como 6700
function padNum(valor, largo) {
  const s = txt(valor);
  if (!s) return null;
  return /^\d+$/.test(s) ? s.padStart(largo, "0") : s;
}

// "55 1234 5678" y "(55) 1234-5678" son telefonos validos mal escritos, no
// errores: les sacamos el formato antes de validar los 10 digitos.
function limpiarTelefono(valor) {
  const s = txt(valor);
  if (!s) return null;
  const digitos = s.replace(/\D/g, "");
  return digitos || s;
}

// ---------------------------------------------------------------- entidades

// El archivo del INE usa el nombre largo del estado; el catalogo de casas el
// corto. Estos 4 son los unicos que no coinciden al normalizar.
const ALIAS_ENTIDAD = {
  "COAHUILA DE ZARAGOZA": "COAHUILA",
  MEXICO: "ESTADO DE MEXICO",
  "MICHOACAN DE OCAMPO": "MICHOACAN",
  "VERACRUZ DE IGNACIO DE LA LLAVE": "VERACRUZ",
};

function entidadCanonica(valor) {
  const n = norm(valor);
  return ALIAS_ENTIDAD[n] || n;
}

// ---------------------------------------------------------------- vigencia

// La credencial dice el AÑO hasta el que vale, y vale todo ese año: una con
// vigencia 2026 sigue siendo valida durante 2026 y vence el 1/1/2027.
function vigenciaMinima() {
  return new Date().getFullYear();
}

// Puede llegar como numero (2027), como texto, o como fecha completa si quien
// capturo escribio 01/01/2027 y Excel lo tomo como fecha.
function anioVigencia(valor) {
  if (valor instanceof Date) return valor.getFullYear();
  const s = txt(valor);
  if (!s) return null;
  // Si la celda quedo formateada como fecha, Excel la guarda como numero de
  // serie (46447 = 1/3/2027). No se confunde con un año escrito a mano.
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000)
    return new Date(Math.round((n - 25569) * 86400000)).getUTCFullYear();
  const m = s.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

// ---------------------------------------------------------------- persona

// Regla del propio Excel: 18 caracteres, sin espacios y posiciones 7-12
// numericas (la fecha de nacimiento). Ademas rechazamos la clave toda
// numerica: una clave real arranca con 6 letras, y si se tipea como numero
// Excel la guarda como float y le cambia los ultimos digitos.
function claveElectorValida(clave) {
  if (!clave || clave.length !== 18) return false;
  if (/\s/.test(clave)) return false;
  if (/^\d+$/.test(clave)) return false;
  return /^\d{6}$/.test(clave.slice(6, 12));
}

// El motivo en castellano, para que el usuario sepa que corregir.
function motivoClaveInvalida(clave) {
  if (!clave) return "sin clave de elector";
  if (/^\d+$/.test(clave))
    return `clave numérica (${clave}) — se capturó como número y Excel le cambia los últimos dígitos`;
  if (/\s/.test(clave)) return `la clave tiene espacios en blanco (${clave})`;
  if (clave.length !== 18)
    return `la clave tiene ${clave.length} caracteres y deben ser 18 (${clave})`;
  return `clave inválida: las posiciones 7 a 12 tienen que ser la fecha de nacimiento en números (${clave})`;
}

function correoValido(correo) {
  if (/\s/.test(correo)) return false;
  const at = correo.indexOf("@");
  if (at < 1) return false;
  return correo.indexOf(".", at) > at + 1;
}

// Columnas N..AC: datos de la persona. Identicas en RD, RG y RC.
const COLUMNAS_PERSONA = [
  "apellido_paterno",
  "apellido_materno",
  "nombre",
  "sexo",
  "clave_elector",
  "vigencia_ine",
  "telefono",
  "correo",
  "calle",
  "numero_exterior",
  "numero_interior",
  "colonia",
  "municipio_domicilio",
  "estado_domicilio",
  "codigo_postal",
  "seccion_electoral",
];

// Nombres lindos para contarle al usuario que campos cambiaron.
const NOMBRE_CAMPO = {
  apellido_paterno: "apellido paterno",
  apellido_materno: "apellido materno",
  nombre: "nombre",
  sexo: "sexo",
  clave_elector: "clave de elector",
  vigencia_ine: "vigencia INE",
  telefono: "teléfono",
  correo: "correo",
  calle: "calle",
  numero_exterior: "número exterior",
  numero_interior: "número interior",
  colonia: "colonia",
  municipio_domicilio: "municipio",
  estado_domicilio: "estado del domicilio",
  codigo_postal: "código postal",
  seccion_electoral: "sección electoral",
};

// Las columnas N..AC tal como vienen en la hoja. Son las mismas posiciones en
// RD, RG y RC, asi que un solo mapeo sirve para las tres.
function mapearPersona(valores) {
  const c = (i) => txt(valores[i]);
  return {
    apellido_paterno: c(14) || null,
    apellido_materno: c(15) || null,
    nombre: c(16) || null,
    sexo: c(17) || null,
    clave_elector: c(18).toUpperCase(),
    vigencia_ine: anioVigencia(valores[19]),
    vigencia_cruda: txt(valores[19]),
    telefono: limpiarTelefono(valores[20]),
    correo: c(21).toLowerCase() || null,
    calle: c(22) || null,
    numero_exterior: c(23) || null,
    numero_interior: c(24) || null,
    colonia: c(25) || null,
    municipio_domicilio: c(26) || null,
    estado_domicilio: c(27) || null,
    codigo_postal: padNum(valores[28], 5),
    seccion_electoral: padNum(valores[29], 4),
  };
}

// Una fila de la plantilla que nadie lleno todavia: no es un error, solo no
// tiene responsable asignado.
function filaSinResponsable(d) {
  return COLUMNAS_PERSONA.every((col) => {
    const v = d[col];
    return v === null || v === undefined || v === "";
  });
}

// Avisos: no frenan la carga, pero se reportan con el numero de fila para que
// se sepa cual corregir.
function motivosAviso(d) {
  const motivos = [];
  const anio = d.vigencia_ine;
  if (anio !== null && anio < vigenciaMinima())
    motivos.push({ tipo: "vigenciaVencida", texto: `INE vencida (vigencia ${anio})` });
  if (anio === null)
    motivos.push({
      tipo: "vigencia",
      texto: d.vigencia_cruda
        ? `no se entiende la vigencia de la INE ("${d.vigencia_cruda}")`
        : "sin vigencia de INE",
    });
  if (d.sexo && !["HOMBRE", "MUJER"].includes(norm(d.sexo)))
    motivos.push({ tipo: "sexo", texto: `sexo "${d.sexo}" no es Hombre ni Mujer` });
  if (d.telefono && !/^\d{10}$/.test(d.telefono))
    motivos.push({ tipo: "telefono", texto: `teléfono inválido (${d.telefono})` });
  if (d.correo && !correoValido(d.correo))
    motivos.push({ tipo: "correo", texto: `correo inválido (${d.correo})` });
  return motivos;
}

// ---------------------------------------------------------------- usuario

// Casa del usuario a partir del nombre: Casa_14 -> 14
function casaDeUsuario(username) {
  const m = /^casa[_\s-]?(\d+)$/i.exec(String(username ?? "").trim());
  return m ? Number(m[1]) : null;
}

// El usuario nacional puede cargar cualquier estado y corregir las columnas
// selladas. En el Excel de usuarios figura como "Casa_nacional".
function esNacional(usuario) {
  return (
    String(usuario.role ?? "").toLowerCase() === "admin" ||
    /NACIONAL/.test(norm(usuario.username))
  );
}

async function resolverUsuario(idUsuario) {
  const [filas] = await pool.query(
    "SELECT id, username, role FROM users WHERE id = ?",
    [idUsuario]
  );
  if (!filas.length) return null;
  const usuario = filas[0];
  usuario.nacional = esNacional(usuario);
  usuario.casa = casaDeUsuario(usuario.username);
  usuario.entidad_norm = null;
  if (!usuario.nacional && usuario.casa !== null) {
    const [casas] = await pool.query(
      "SELECT entidad, entidad_norm FROM casas WHERE casa = ?",
      [usuario.casa]
    );
    if (casas.length) {
      usuario.entidad = casas[0].entidad;
      usuario.entidad_norm = casas[0].entidad_norm;
    }
  }
  return usuario;
}

// Mapa entidad -> casas que la cubren. Una entidad puede tener varias
// (CDMX tiene 5), por eso es una lista: sirve para decirle al usuario de que
// casa es el registro que se descarto.
async function casasPorEntidad() {
  const [todas] = await pool.query("SELECT casa, entidad_norm FROM casas");
  const mapa = new Map();
  for (const c of todas) {
    if (!mapa.has(c.entidad_norm)) mapa.set(c.entidad_norm, []);
    mapa.get(c.entidad_norm).push(c.casa);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a - b);
  return mapa;
}

// "corresponde a la casa 4" / "corresponde a las casas 9, 10 y 11"
function frasePertenencia(mapa, entidadNorm) {
  const casas = mapa.get(entidadNorm);
  if (!casas || !casas.length) return "a otra casa";
  if (casas.length === 1) return `a la casa ${casas[0]}`;
  return `a las casas ${casas.slice(0, -1).join(", ")} y ${casas[casas.length - 1]}`;
}

module.exports = {
  pool,
  norm,
  txt,
  num,
  padNum,
  limpiarTelefono,
  entidadCanonica,
  ALIAS_ENTIDAD,
  vigenciaMinima,
  anioVigencia,
  claveElectorValida,
  motivoClaveInvalida,
  correoValido,
  COLUMNAS_PERSONA,
  NOMBRE_CAMPO,
  mapearPersona,
  filaSinResponsable,
  motivosAviso,
  casaDeUsuario,
  esNacional,
  resolverUsuario,
  casasPorEntidad,
  frasePertenencia,
};
