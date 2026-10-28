// Reportes de Responsables Generales.
//
// Mismo alcance que RD: cada casa ve SOLO lo que subio ella, aislada incluso
// de otras casas de su misma entidad. El usuario nacional ve todo. El filtro
// sale del token, nunca de algo que mande el navegador.
//
// Diferencia con RD: el listado va paginado del lado del servidor. En RD son
// 300 filas y se mandan todas; aca una casa puede tener 21 mil y el nacional
// 173 mil, que no se pueden volcar al navegador.
require("dotenv").config();
const V = require("./validaciones");
const pool = V.pool;

// Casillas de la plantilla: una fila por casilla. Es el universo a cubrir;
// la tabla RG solo guarda las que YA tienen responsable asignado.
const TOTAL_CASILLAS = 173396;
const MAX_PAGINA = 200;

async function alcanceDe(req) {
  const usuario = await V.resolverUsuario(req.user && req.user.id);
  if (!usuario) return null;
  if (usuario.nacional) {
    return { nacional: true, where: "", params: [], entidad: "Todas" };
  }
  if (!usuario.entidad_norm || usuario.casa === null) {
    // usuario sin casa asociada: no ve nada, en vez de ver todo
    return { nacional: false, where: "WHERE 1 = 0", params: [], entidad: null };
  }
  // Excepcion: lo que subio el nacional (casa_carga queda NULL) se muestra
  // igual a la casa de esa entidad, para que una correccion del nacional no
  // quede invisible para todos.
  return {
    nacional: false,
    where: "WHERE (casa_carga = ? OR (casa_carga IS NULL AND estado_norm = ?))",
    params: [String(usuario.casa), usuario.entidad_norm],
    entidad: usuario.entidad,
    casa: usuario.casa,
  };
}

async function getResumenRG(req, res) {
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
       FROM RG ${a.where}`,
      [V.vigenciaMinima(), ...a.params]
    );

    const [porEntidad] = await pool.query(
      `SELECT estado, COUNT(*) AS cargados
       FROM RG ${a.where}
       GROUP BY estado, estado_norm ORDER BY cargados DESC, estado ASC`,
      a.params
    );

    const [porCasa] = await pool.query(
      `SELECT r.casa_carga AS casa, c.entidad, COUNT(*) AS cargados
       FROM RG r LEFT JOIN casas c ON c.casa = r.casa_carga
       ${a.where ? a.where + " AND" : "WHERE"} r.casa_carga IS NOT NULL
       GROUP BY r.casa_carga, c.entidad
       ORDER BY cargados DESC, casa ASC
       LIMIT 10`,
      a.params
    );

    const [ultimas] = await pool.query(
      `SELECT estado, seccion_electoral_ubic, casilla, nombre, apellido_paterno,
              usuario_subida, fecha_subida
       FROM RG ${a.where} ORDER BY fecha_subida DESC LIMIT 5`,
      a.params
    );

    const cargados = Number(totales.cargados) || 0;
    // El universo de 173.396 casillas solo tiene sentido a nivel nacional: no
    // sabemos cuantas casillas tiene cada entidad, asi que para una casa se
    // informa el total cargado sin porcentaje inventado.
    return res.json({
      nacional: a.nacional,
      entidadUsuario: a.entidad,
      totalDistritos: a.nacional ? TOTAL_CASILLAS : null,
      cargados,
      faltantes: a.nacional ? Math.max(TOTAL_CASILLAS - cargados, 0) : null,
      avance: a.nacional ? Math.round((cargados / TOTAL_CASILLAS) * 1000) / 10 : null,
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
      .json({ message: "No se pudo armar el reporte de RG", error: error.message });
  }
}

const COLUMNAS_LISTADO = `
  id, estado, seccion_electoral_ubic, tipo_seccion, tipo_casilla, casilla,
  distrito_federal, cabecera_federal, municipio, distrito_local, cargo,
  apellido_paterno, apellido_materno, nombre, sexo, clave_elector, vigencia_ine,
  telefono, correo, calle, numero_exterior, numero_interior, colonia,
  municipio_domicilio, estado_domicilio, codigo_postal, seccion_electoral,
  casa_carga, usuario_subida, fecha_subida`;

async function getListadoRG(req, res) {
  try {
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    const pagina = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const porPagina = Math.min(
      Math.max(parseInt(req.query.pageSize, 10) || 50, 1),
      MAX_PAGINA
    );

    // busqueda libre opcional: nombre, apellido, clave o seccion
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
      `SELECT COUNT(*) AS total FROM RG ${where}`,
      params
    );

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_LISTADO}
       FROM RG ${where}
       ORDER BY estado ASC, seccion_electoral_ubic ASC, tipo_casilla ASC, casilla ASC
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
      .json({ message: "No se pudo traer el listado de RG", error: error.message });
  }
}

// Exportar a CSV lo que el usuario puede ver. Va en streaming: con 21 mil
// filas armar el archivo entero en memoria antes de mandarlo es un
// desperdicio, y con 173 mil directamente no entra.
async function exportarRG(req, res) {
  let conexion;
  try {
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    const cabeceras = [
      "Estado", "Sección", "Tipo de Sección", "Tipo de Casilla", "Casilla",
      "Distrito Federal", "Cabecera", "Municipio", "Distrito Local", "Cargo",
      "Apellido Paterno", "Apellido Materno", "Nombre(s)", "Sexo",
      "Clave de Elector", "Vigencia INE", "Teléfono", "Correo",
      "Calle", "Número Exterior", "Número Interior", "Colonia",
      "Municipio Domicilio", "Estado Domicilio", "Código Postal", "Sección Domicilio",
      "Casa", "Cargado por", "Fecha",
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Responsables_Generales_${new Date().toISOString().slice(0, 10)}.csv"`
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
        `SELECT ${COLUMNAS_LISTADO} FROM RG ${a.where}
         ORDER BY estado ASC, seccion_electoral_ubic ASC, tipo_casilla ASC, casilla ASC`,
        a.params
      )
      .stream();

    for await (const f of stream) {
      res.write(
        [
          f.estado, f.seccion_electoral_ubic, f.tipo_seccion, f.tipo_casilla, f.casilla,
          f.distrito_federal, f.cabecera_federal, f.municipio, f.distrito_local, f.cargo,
          f.apellido_paterno, f.apellido_materno, f.nombre, f.sexo,
          f.clave_elector, f.vigencia_ine, f.telefono, f.correo,
          f.calle, f.numero_exterior, f.numero_interior, f.colonia,
          f.municipio_domicilio, f.estado_domicilio, f.codigo_postal, f.seccion_electoral,
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

module.exports = { getResumenRG, getListadoRG, exportarRG };
