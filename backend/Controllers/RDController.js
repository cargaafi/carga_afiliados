require("dotenv").config();
const mysql = require("mysql2");
const pool = mysql
  .createPool({
    uri: process.env.DATABASE_URL,
  })
  .promise();
const ExcelJS = require("exceljs");

const HOJA_RD = "Responsables de Distrito";
const VIGENCIA_MINIMA = 2026;
const MAX_FILAS_ENCABEZADO = 8; // hasta donde buscamos la fila de encabezados

// Firma de la hoja RD: columnas ancla en su posicion exacta. Con estas 5 ya
// sabemos que es RD y que las columnas no se corrieron.
// RG y RC arrancan con "Seccion Electoral" / "Tipo de Seccion" / "Casilla",
// asi que no se pueden colar aunque la hoja se llame distinto.
const ANCLAS_RD = {
  1: "ESTADO",
  4: "DISTRITO ELECTORAL FEDERAL",
  13: "CARGO",
  18: "CLAVE DE ELECTOR",
  29: "SECCION ELECTORAL",
};

// Para poder decirle al usuario QUE archivo subio en vez de un error generico.
const ANCLAS_RG_RC = { 1: "SECCION ELECTORAL", 2: "TIPO DE SECCION", 4: "CASILLA" };

function coincideFirma(valores, anclas) {
  return Object.entries(anclas).every(
    ([col, esperado]) => norm(valores[Number(col)]) === esperado
  );
}

// El archivo del INE usa el nombre largo del estado; el catalogo de casas el
// corto. Estos 4 son los unicos que no coinciden al normalizar.
const ALIAS_ENTIDAD = {
  "COAHUILA DE ZARAGOZA": "COAHUILA",
  MEXICO: "ESTADO DE MEXICO",
  "MICHOACAN DE OCAMPO": "MICHOACAN",
  "VERACRUZ DE IGNACIO DE LA LLAVE": "VERACRUZ",
};

function norm(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function entidadCanonica(valor) {
  const n = norm(valor);
  return ALIAS_ENTIDAD[n] || n;
}

// Las celdas de exceljs pueden venir como texto, numero, formula, richText o
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

// "55 1234 5678" y "(55) 1234-5678" son telefonos validos mal escritos, no
// errores: les sacamos el formato antes de validar los 10 digitos.
function limpiarTelefono(valor) {
  const s = txt(valor);
  if (!s) return null;
  const digitos = s.replace(/\D/g, "");
  return digitos || s; // si no quedo ningun digito devolvemos el original para reportarlo
}

// Excel guarda CP y seccion como numero: 06700 llega como 6700
function padNum(valor, largo) {
  const s = txt(valor);
  if (!s) return null;
  return /^\d+$/.test(s) ? s.padStart(largo, "0") : s;
}

// Regla del propio Excel: 18 caracteres, sin espacios y posiciones 7-12
// numericas (la fecha de nacimiento).
// Ademas rechazamos la clave toda numerica: una clave real arranca con 6
// letras, y si se tipea como numero Excel la guarda como float y le cambia
// los ultimos digitos (123456789012345678 -> 123456789012345680).
function claveElectorValida(clave) {
  if (clave.length !== 18) return false;
  if (/\s/.test(clave)) return false;
  if (/^\d+$/.test(clave)) return false;
  return /^\d{6}$/.test(clave.slice(6, 12));
}

// Una fila de la plantilla que nadie lleno todavia: no es un error, solo no
// tiene responsable asignado.
function filaSinResponsable(d) {
  return COLUMNAS_PERSONA.every((col) => {
    const v = d[col];
    return v === null || v === undefined || v === "";
  });
}

function correoValido(correo) {
  if (/\s/.test(correo)) return false;
  const at = correo.indexOf("@");
  if (at < 1) return false;
  return correo.indexOf(".", at) > at + 1;
}

// Columnas A..M: datos del INE. Se sellan en la primera carga.
const COLUMNAS_INE = [
  "estado",
  "estado_norm",
  "casa",
  "circunscripcion",
  "distrito_federal",
  "cabecera",
  "municipios",
  "secciones_electorales",
  "casillas",
  "casillas_basicas",
  "casillas_contiguas",
  "casillas_extraordinarias",
  "casillas_especiales",
  "cargo",
];

// Columnas N..AC: datos de la persona.
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

function mapearFila(valores) {
  const c = (i) => txt(valores[i]);
  const estado = c(1);
  const clave = c(18).toUpperCase();
  return {
    estado,
    estado_norm: entidadCanonica(estado),
    casa: c(2) || null,
    circunscripcion: num(valores[3]),
    distrito_federal: num(valores[4]),
    cabecera: c(5) || null,
    municipios: num(valores[6]),
    secciones_electorales: num(valores[7]),
    casillas: num(valores[8]),
    casillas_basicas: num(valores[9]),
    casillas_contiguas: num(valores[10]),
    casillas_extraordinarias: num(valores[11]),
    casillas_especiales: num(valores[12]),
    cargo: c(13) || null,
    apellido_paterno: c(14) || null,
    apellido_materno: c(15) || null,
    nombre: c(16) || null,
    sexo: c(17) || null,
    clave_elector: clave,
    vigencia_ine: num(valores[19]),
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

async function leerHojaRD(file) {
  const origen = file.path || file.buffer;
  const opciones = {
    entries: "emit",
    sharedStrings: "cache",
    worksheets: "emit",
  };
  const reader = file.path
    ? new ExcelJS.stream.xlsx.WorkbookReader(origen, opciones)
    : new ExcelJS.stream.xlsx.WorkbookReader(require("stream").Readable.from(origen), opciones);

  const filas = [];
  let encontrada = false;
  let pareceRGoRC = null;

  for await (const hoja of reader) {
    let filaEncabezado = null;

    for await (const fila of hoja) {
      // Todavia buscando el encabezado: la hoja puede venir con las 2 filas de
      // titulos agrupados (encabezado en la 3) o recortada (encabezado en la 1).
      if (filaEncabezado === null) {
        if (fila.number > MAX_FILAS_ENCABEZADO) break;
        if (coincideFirma(fila.values, ANCLAS_RD)) {
          filaEncabezado = fila.number;
          encontrada = true;
          continue;
        }
        if (!pareceRGoRC && coincideFirma(fila.values, ANCLAS_RG_RC)) {
          pareceRGoRC = hoja.name;
        }
        continue;
      }

      const valores = fila.values;
      if (!valores || valores.every((v) => txt(v) === "")) continue; // fila vacia
      filas.push({ numero: fila.number, datos: mapearFila(valores) });
    }

    // Encontrada la hoja de RD, no seguimos: RG y RC tienen cientos de miles
    // de filas y recorrerlas costaria minutos.
    if (encontrada) break;
  }

  if (!encontrada) {
    if (pareceRGoRC) {
      throw new Error(
        `El archivo que subiste es el de Responsables Generales o de Casilla (hoja "${pareceRGoRC}"), no el de Distrito. Subí el que tiene la hoja "${HOJA_RD}".`
      );
    }
    throw new Error(
      `No encontré los encabezados de Responsables de Distrito. La fila de encabezados tiene que empezar con "Estado", y tener "Distrito Electoral Federal", "Cargo" y "Clave de Elector" en su lugar.`
    );
  }
  return filas;
}

async function uploadRD(req, res) {
  let conexion;
  try {
    if (!req.file) throw new Error("No se recibió ningún archivo");

    const usuario = await resolverUsuario(req.user && req.user.id);
    if (!usuario) return res.status(401).json({ message: "Usuario no válido" });

    if (!usuario.nacional && !usuario.entidad_norm) {
      return res.status(403).json({
        message:
          `Tu usuario (${usuario.username}) no está asociado a ninguna casa, así que no podés cargar. ` +
          `El nombre de usuario tiene que ser del tipo "Casa_14".`,
      });
    }

    const filas = await leerHojaRD(req.file);

    const resumen = {
      filasLeidas: filas.length,
      nuevos: 0,
      actualizados: 0,
      reemplazados: 0,
      sinCambios: 0,
      sinResponsable: 0,
      descartados: { claveInvalida: 0, sinDistrito: 0, otroEstado: 0 },
      avisos: { vigencia: 0, sexo: 0, telefono: 0, correo: 0 },
      entidadUsuario: usuario.nacional ? "Todas" : usuario.entidad,
      detalle: [],
    };
    const agregarDetalle = (fila, motivo) => {
      if (resumen.detalle.length < 50)
        resumen.detalle.push({ fila: fila.numero, motivo });
    };

    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    for (const fila of filas) {
      const d = fila.datos;

      // Fila de la plantilla sin llenar: no es un error, no ensucia el resumen.
      if (filaSinResponsable(d)) {
        resumen.sinResponsable++;
        continue;
      }

      if (!d.estado_norm || d.distrito_federal === null) {
        resumen.descartados.sinDistrito++;
        agregarDetalle(fila, "sin estado o sin distrito federal");
        continue;
      }

      if (!usuario.nacional && d.estado_norm !== usuario.entidad_norm) {
        resumen.descartados.otroEstado++;
        agregarDetalle(
          fila,
          `${d.estado} (distrito ${d.distrito_federal}) no es de tu casa`
        );
        continue;
      }

      if (!claveElectorValida(d.clave_elector)) {
        let motivo;
        if (!d.clave_elector) motivo = "sin clave de elector";
        else if (/^\d+$/.test(d.clave_elector))
          motivo = `clave numérica (${d.clave_elector}) — se capturó como número y Excel le cambia los últimos dígitos`;
        else motivo = `clave de elector inválida (${d.clave_elector})`;
        resumen.descartados.claveInvalida++;
        agregarDetalle(fila, motivo);
        continue;
      }

      // avisos: no frenan la carga
      if (d.vigencia_ine === null || d.vigencia_ine < VIGENCIA_MINIMA)
        resumen.avisos.vigencia++;
      if (d.sexo && !["HOMBRE", "MUJER"].includes(norm(d.sexo)))
        resumen.avisos.sexo++;
      if (d.telefono && !/^\d{10}$/.test(d.telefono)) resumen.avisos.telefono++;
      if (d.correo && !correoValido(d.correo)) resumen.avisos.correo++;

      const [existentes] = await conexion.query(
        "SELECT * FROM RD WHERE estado_norm = ? AND distrito_federal = ? LIMIT 1",
        [d.estado_norm, d.distrito_federal]
      );

      if (!existentes.length) {
        const columnas = [...COLUMNAS_INE, ...COLUMNAS_PERSONA, "casa_carga", "usuario_subida"];
        const valores = columnas.map((col) => {
          if (col === "casa_carga") return usuario.casa;
          if (col === "usuario_subida") return usuario.username;
          return d[col] ?? null;
        });
        await conexion.query(
          `INSERT INTO RD (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
          valores
        );
        resumen.nuevos++;
        continue;
      }

      const actual = existentes[0];
      const cambioPersona = String(actual.clave_elector ?? "") !== d.clave_elector;
      const sets = [];
      const valores = [];

      if (cambioPersona) {
        // Responsable distinto: se reescribe el bloque entero, vacios incluidos,
        // para que el nuevo no herede telefono/correo del anterior.
        for (const col of COLUMNAS_PERSONA) {
          sets.push(`${col} = ?`);
          valores.push(d[col] ?? null);
        }
      } else {
        // Mismo responsable: lo que viene en blanco no pisa lo que ya estaba.
        for (const col of COLUMNAS_PERSONA) {
          const nuevo = d[col];
          if (nuevo === null || nuevo === "") continue;
          if (String(actual[col] ?? "") === String(nuevo)) continue;
          sets.push(`${col} = ?`);
          valores.push(nuevo);
        }
      }

      // A..M siguen selladas salvo que las corrija el usuario Nacional
      if (usuario.nacional) {
        for (const col of COLUMNAS_INE) {
          const nuevo = d[col];
          if (nuevo === null || nuevo === "") continue;
          if (String(actual[col] ?? "") === String(nuevo)) continue;
          sets.push(`${col} = ?`);
          valores.push(nuevo);
        }
      }

      if (!sets.length) {
        resumen.sinCambios++;
        continue;
      }

      sets.push("casa_carga = ?", "usuario_subida = ?");
      valores.push(usuario.casa, usuario.username, actual.id);
      await conexion.query(`UPDATE RD SET ${sets.join(", ")} WHERE id = ?`, valores);

      if (cambioPersona) resumen.reemplazados++;
      else resumen.actualizados++;
    }

    await conexion.commit();
    conexion.release();

    return res.json({ message: "Archivo procesado correctamente.", resumen });
  } catch (error) {
    if (conexion) {
      try {
        await conexion.rollback();
      } catch (_) {}
      conexion.release();
    }
    return res.status(500).json({
      message: error.message || "Error al procesar el archivo.",
      error: error.toString(),
    });
  }
}

module.exports = {
  uploadRD,
  // exportadas para poder probarlas sin base de datos
  norm,
  entidadCanonica,
  claveElectorValida,
  correoValido,
  casaDeUsuario,
  mapearFila,
  leerHojaRD,
  padNum,
};
