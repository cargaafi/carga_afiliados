require("dotenv").config();
const mysql = require("mysql2");
const pool = mysql
  .createPool({
    uri: process.env.DATABASE_URL,
  })
  .promise();
const ExcelJS = require("exceljs");
const fs = require("fs");

const HOJA_RD = "Responsables de Distrito";
// La credencial dice el AÑO hasta el que vale, y vale todo ese año: una con
// vigencia 2026 sigue siendo valida durante 2026 y vence el 1/1/2027.
// Se calcula con el año en curso, no fijo, para que no haya que tocar el
// codigo cada enero.
function vigenciaMinima() {
  return new Date().getFullYear();
}

// La vigencia es el año impreso en la credencial, pero puede llegar como
// numero (2027), como texto, o como fecha completa si quien capturo escribio
// 01/01/2027 y Excel lo tomo como fecha. En todos los casos nos quedamos con
// el año de 4 digitos; si no hay ninguno devolvemos null y lo reportamos.
function anioVigencia(valor) {
  if (valor instanceof Date) return valor.getFullYear();
  const s = txt(valor);
  if (!s) return null;
  // Si la celda quedo formateada como fecha, Excel la guarda como numero de
  // serie (46447 = 1/3/2027). No se confunde con un año escrito a mano: los
  // años son de 4 digitos y las series de fechas reales pasan de 20000.
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000)
    return new Date(Math.round((n - 25569) * 86400000)).getUTCFullYear();
  const m = s.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}
const MAX_FILAS_ENCABEZADO = 8; // hasta donde buscamos la fila de encabezados

// Topes del detalle que viaja al navegador. Los errores a corregir van casi
// todos; las filas de otras casas van con tope chico porque no son un error.
const MAX_DETALLE = 2000;
const MAX_DETALLE_AJENAS = 100;

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
    vigencia_ine: anioVigencia(valores[19]),
    // el texto tal cual vino, solo para poder explicar el descarte
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
        `El archivo que subiste es el de Responsables Generales o de Casilla (hoja "${pareceRGoRC}"), no el de Distrito. Sube el que tiene la hoja "${HOJA_RD}".`
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
          `Tu usuario (${usuario.username}) no está asociado a ninguna casa, así que no puedes cargar. ` +
          `El nombre de usuario tiene que ser del tipo "Casa_14".`,
      });
    }

    const filas = await leerHojaRD(req.file);

    // Para poder decirle al usuario de qué casa es el distrito que descartamos.
    // Una entidad puede tener varias casas (CDMX tiene 5), por eso es una lista.
    const [todasLasCasas] = await pool.query("SELECT casa, entidad_norm FROM casas");
    const casasPorEntidad = new Map();
    for (const c of todasLasCasas) {
      if (!casasPorEntidad.has(c.entidad_norm)) casasPorEntidad.set(c.entidad_norm, []);
      casasPorEntidad.get(c.entidad_norm).push(c.casa);
    }
    for (const lista of casasPorEntidad.values()) lista.sort((a, b) => a - b);

    const resumen = {
      filasLeidas: filas.length,
      nuevos: 0,
      actualizados: 0,
      reemplazados: 0,
      sinCambios: 0,
      sinResponsable: 0,
      descartados: { claveInvalida: 0, sinDistrito: 0, otroEstado: 0, datosIncompletos: 0 },
      avisos: { sexo: 0, correo: 0 },
      entidadUsuario: usuario.nacional ? "Todas" : usuario.entidad,
      detalle: [],
      avisosDetalle: [],
      cambios: [],
    };
    // Los errores que hay que corregir se listan practicamente todos: en RD
    // hay 300 filas como maximo, asi que el tope nunca se alcanza.
    // Las de "corresponde a otra casa" van aparte y con tope chico: no son un
    // error (pasa siempre que alguien sube el archivo completo) y listarlas
    // todas solo haria el resumen ilegible. El contador igual las cuenta.
    let listadosError = 0;
    let listadosAjenos = 0;
    const agregarDetalle = (fila, motivo, esAjena = false) => {
      if (esAjena) {
        if (listadosAjenos >= MAX_DETALLE_AJENAS) return;
        listadosAjenos++;
      } else {
        if (listadosError >= MAX_DETALLE) return;
        listadosError++;
      }
      resumen.detalle.push({ fila: fila.numero, motivo, ajena: esAjena || undefined });
    };
    // La fila se cargo, pero hay algo que conviene corregir: se lista aparte
    // de los descartados, que son los que NO entraron.
    const agregarAviso = (fila, d, texto) => {
      if (resumen.avisosDetalle.length < MAX_DETALLE)
        resumen.avisosDetalle.push({
          fila: fila.numero,
          distrito: d.distrito_federal,
          texto,
        });
    };
    const agregarCambio = (fila, d, texto) => {
      if (resumen.cambios.length < 100)
        resumen.cambios.push({
          fila: fila.numero,
          ubicacion: `${d.estado} · distrito ${d.distrito_federal}`,
          texto,
        });
    };
    const nombreCompleto = (o) =>
      [o.nombre, o.apellido_paterno, o.apellido_materno].filter(Boolean).join(" ") ||
      "(sin nombre)";

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
        const ajenas = casasPorEntidad.get(d.estado_norm);
        let deQuien;
        if (!ajenas || !ajenas.length) deQuien = "a otra casa";
        else if (ajenas.length === 1) deQuien = `a la casa ${ajenas[0]}`;
        else
          deQuien = `a las casas ${ajenas.slice(0, -1).join(", ")} y ${
            ajenas[ajenas.length - 1]
          }`;
        agregarDetalle(
          fila,
          `distrito ${d.distrito_federal} — corresponde ${deQuien}, no a la casa ${usuario.casa}`,
          true // es de otra casa: tope aparte
        );
        continue;
      }

      if (!claveElectorValida(d.clave_elector)) {
        const clave = d.clave_elector;
        let motivo;
        if (!clave) {
          motivo = "sin clave de elector";
        } else if (/^\d+$/.test(clave)) {
          motivo = `clave numérica (${clave}) — se capturó como número y Excel le cambia los últimos dígitos`;
        } else if (/\s/.test(clave)) {
          motivo = `la clave tiene espacios en blanco (${clave})`;
        } else if (clave.length !== 18) {
          motivo = `la clave tiene ${clave.length} caracteres y deben ser 18 (${clave})`;
        } else {
          motivo = `clave inválida: las posiciones 7 a 12 tienen que ser la fecha de nacimiento en números (${clave})`;
        }
        resumen.descartados.claveInvalida++;
        agregarDetalle(fila, motivo);
        continue;
      }

      // vigencia de INE, telefono y codigo postal son obligatorios: si falta
      // alguno, o el telefono no son 10 digitos numericos, la fila no se sube.
      const anio = d.vigencia_ine;
      const motivosDatos = [];
      if (anio === null) {
        motivosDatos.push(
          d.vigencia_cruda
            ? `no se entiende la vigencia de la INE ("${d.vigencia_cruda}")`
            : "sin vigencia de INE"
        );
      } else if (anio < vigenciaMinima()) {
        motivosDatos.push(`INE vencida (vigencia ${anio})`);
      }
      if (!d.telefono) {
        motivosDatos.push("sin teléfono");
      } else if (!/^\d+$/.test(d.telefono)) {
        motivosDatos.push(`el teléfono tiene letras o símbolos (${d.telefono})`);
      } else if (d.telefono.length !== 10) {
        motivosDatos.push(
          `el teléfono tiene ${d.telefono.length} dígitos y deben ser 10 (${d.telefono})`
        );
      }
      if (!d.codigo_postal) motivosDatos.push("sin código postal");
      if (motivosDatos.length) {
        resumen.descartados.datosIncompletos++;
        agregarDetalle(fila, motivosDatos.join(" · "));
        continue;
      }

      // avisos: no frenan la carga, pero conviene corregirlos.
      const motivosAviso = [];
      if (d.sexo && !["HOMBRE", "MUJER"].includes(norm(d.sexo))) {
        resumen.avisos.sexo++;
        motivosAviso.push(`sexo "${d.sexo}" no es Hombre ni Mujer`);
      }
      if (d.correo && !correoValido(d.correo)) {
        resumen.avisos.correo++;
        motivosAviso.push(`correo inválido (${d.correo})`);
      }
      if (motivosAviso.length) agregarAviso(fila, d, motivosAviso.join(" · "));

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
      const camposCambiados = [];

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
          camposCambiados.push(NOMBRE_CAMPO[col] || col);
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

      if (cambioPersona) {
        resumen.reemplazados++;
        agregarCambio(
          fila,
          d,
          `cambió el responsable: ${nombreCompleto(actual)} → ${nombreCompleto(d)}`
        );
      } else {
        resumen.actualizados++;
        agregarCambio(fila, d, `se actualizó ${camposCambiados.join(", ")}`);
      }
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
  } finally {
    // multer deja el Excel en uploads/ y nadie lo borraba: con 56 casas
    // subiendo archivos de decenas de MB el disco se llena y el servicio cae.
    if (req.file && req.file.path) {
      fs.promises.unlink(req.file.path).catch((e) => {
        console.error("No se pudo borrar el temporal", req.file.path, e.message);
      });
    }
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
  resolverUsuario,
  padNum,
};
