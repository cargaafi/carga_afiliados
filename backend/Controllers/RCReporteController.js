// Reportes de Responsables de Casilla.
//
// Mismo alcance que RD y RG: cada casa ve solo su entidad, el usuario
// nacional ve todo. El filtro sale del token, nunca de algo que mande el
// navegador.
//
// Diferencia con RG: el universo no son las 173.396 casillas sino los
// 346.792 LUGARES a cubrir (2 responsables por casilla: Propietario 1 y 2).
require("dotenv").config();
const V = require("./validaciones");
const pool = V.pool;

const TOTAL_LUGARES = 346792; // 173.396 casillas x 2 responsables
const MAX_PAGINA = 200;

async function alcanceDe(req) {
  const usuario = await V.resolverUsuario(req.user && req.user.id);
  if (!usuario) return null;
  if (usuario.nacional) {
    return { nacional: true, where: "", params: [], entidad: "Todas" };
  }
  if (!usuario.entidad_norm) {
    // usuario sin casa asociada: no ve nada, en vez de ver todo
    return { nacional: false, where: "WHERE 1 = 0", params: [], entidad: null };
  }
  return {
    nacional: false,
    where: "WHERE estado_norm = ?",
    params: [usuario.entidad_norm],
    entidad: usuario.entidad,
    casa: usuario.casa,
  };
}

async function getResumenRC(req, res) {
  try {
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    const [[totales]] = await pool.query(
      `SELECT
         COUNT(*)                                       AS cargados,
         COUNT(DISTINCT casa_carga)                     AS casas,
         COUNT(DISTINCT estado_norm)                    AS entidades,
         SUM(vigencia_ine IS NULL OR vigencia_ine < ?)  AS ineVencido,
         SUM(telefono IS NULL OR telefono = '')         AS sinTelefono,
         SUM(correo IS NULL OR correo = '')             AS sinCorreo
       FROM RC ${a.where}`,
      [V.vigenciaMinima(), ...a.params]
    );

    const [porEntidad] = await pool.query(
      `SELECT estado, COUNT(*) AS cargados
       FROM RC ${a.where}
       GROUP BY estado, estado_norm ORDER BY cargados DESC, estado ASC`,
      a.params
    );

    const [porCasa] = await pool.query(
      `SELECT r.casa_carga AS casa, c.entidad, COUNT(*) AS cargados
       FROM RC r LEFT JOIN casas c ON c.casa = r.casa_carga
       ${a.where ? a.where + " AND" : "WHERE"} r.casa_carga IS NOT NULL
       GROUP BY r.casa_carga, c.entidad
       ORDER BY cargados DESC, casa ASC
       LIMIT 10`,
      a.params
    );

    const [ultimas] = await pool.query(
      `SELECT estado, seccion_electoral_ubic, casilla, cargo, nombre, apellido_paterno,
              usuario_subida, fecha_subida
       FROM RC ${a.where} ORDER BY fecha_subida DESC LIMIT 5`,
      a.params
    );

    const cargados = Number(totales.cargados) || 0;
    // El universo de 346.792 lugares solo tiene sentido a nivel nacional: no
    // sabemos cuantos le tocan a cada entidad, asi que para una casa se
    // informa el total cargado sin porcentaje inventado.
    return res.json({
      nacional: a.nacional,
      entidadUsuario: a.entidad,
      totalDistritos: a.nacional ? TOTAL_LUGARES : null,
      cargados,
      faltantes: a.nacional ? Math.max(TOTAL_LUGARES - cargados, 0) : null,
      avance: a.nacional ? Math.round((cargados / TOTAL_LUGARES) * 1000) / 10 : null,
      casas: Number(totales.casas) || 0,
      entidades: Number(totales.entidades) || 0,
      ineVencido: Number(totales.ineVencido) || 0,
      sinTelefono: Number(totales.sinTelefono) || 0,
      sinCorreo: Number(totales.sinCorreo) || 0,
      porEntidad,
      porCasa,
      ultimas,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "No se pudo armar el reporte de RC", error: error.message });
  }
}

const COLUMNAS_LISTADO = `
  id, estado, seccion_electoral_ubic, tipo_seccion, tipo_casilla, casilla, cargo,
  distrito_federal, cabecera_federal, municipio, distrito_local,
  apellido_paterno, apellido_materno, nombre, sexo, clave_elector, vigencia_ine,
  telefono, correo, calle, numero_exterior, numero_interior, colonia,
  municipio_domicilio, estado_domicilio, codigo_postal, seccion_electoral, origen,
  casa_carga, usuario_subida, fecha_subida`;

async function getListadoRC(req, res) {
  try {
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    const pagina = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const porPagina = Math.min(
      Math.max(parseInt(req.query.pageSize, 10) || 50, 1),
      MAX_PAGINA
    );

    // busqueda libre opcional: nombre, apellido, clave, seccion o casilla
    const texto = String(req.query.q || "").trim();
    let where = a.where;
    const params = [...a.params];
    if (texto) {
      const like = `%${texto}%`;
      where += (where ? " AND " : "WHERE ") +
        `(apellido_paterno LIKE ? OR apellido_materno LIKE ? OR nombre LIKE ?
          OR clave_elector LIKE ? OR seccion_electoral_ubic LIKE ? OR casilla LIKE ?)`;
      params.push(like, like, like, like, like, like);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM RC ${where}`,
      params
    );

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_LISTADO}
       FROM RC ${where}
       ORDER BY estado ASC, seccion_electoral_ubic ASC, tipo_casilla ASC, casilla ASC, cargo ASC
       LIMIT ? OFFSET ?`,
      [...params, porPagina, pagina * porPagina]
    );

    return res.json({
      data: filas,
      total: Number(total) || 0,
      page: pagina,
      pageSize: porPagina,
      nacional: a.nacional,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "No se pudo traer el listado de RC", error: error.message });
  }
}

// Exportar a CSV lo que el usuario puede ver. Va en streaming: con 347 mil
// filas armar el archivo entero en memoria antes de mandarlo no entra.
async function exportarRC(req, res) {
  let conexion;
  try {
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    const cabeceras = [
      "Estado", "Sección", "Tipo de Sección", "Tipo de Casilla", "Casilla", "Cargo",
      "Distrito Federal", "Cabecera", "Municipio", "Distrito Local",
      "Apellido Paterno", "Apellido Materno", "Nombre(s)", "Sexo",
      "Clave de Elector", "Vigencia INE", "Teléfono", "Correo",
      "Calle", "Número Exterior", "Número Interior", "Colonia",
      "Municipio Domicilio", "Estado Domicilio", "Código Postal", "Sección Domicilio", "Origen",
      "Casa", "Cargado por", "Fecha",
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Responsables_de_Casilla_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.write("﻿" + cabeceras.join(",") + "\n"); // BOM para que Excel respete los acentos

    const csv = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    conexion = await pool.getConnection();
    const stream = conexion.connection
      .query(
        `SELECT ${COLUMNAS_LISTADO} FROM RC ${a.where}
         ORDER BY estado ASC, seccion_electoral_ubic ASC, tipo_casilla ASC, casilla ASC, cargo ASC`,
        a.params
      )
      .stream();

    for await (const f of stream) {
      res.write(
        [
          f.estado, f.seccion_electoral_ubic, f.tipo_seccion, f.tipo_casilla, f.casilla, f.cargo,
          f.distrito_federal, f.cabecera_federal, f.municipio, f.distrito_local,
          f.apellido_paterno, f.apellido_materno, f.nombre, f.sexo,
          f.clave_elector, f.vigencia_ine, f.telefono, f.correo,
          f.calle, f.numero_exterior, f.numero_interior, f.colonia,
          f.municipio_domicilio, f.estado_domicilio, f.codigo_postal, f.seccion_electoral, f.origen,
          f.casa_carga, f.usuario_subida,
          f.fecha_subida ? new Date(f.fecha_subida).toLocaleString("es-MX") : "",
        ].map(csv).join(",") + "\n"
      );
    }
    conexion.release();
    return res.end();
  } catch (error) {
    if (conexion) conexion.release();
    if (res.headersSent) return res.end();
    return res
      .status(500)
      .json({ message: "No se pudo exportar el listado", error: error.message });
  }
}

module.exports = { getResumenRC, getListadoRC, exportarRC };
