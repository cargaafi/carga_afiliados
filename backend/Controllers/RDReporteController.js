require("dotenv").config();
const mysql = require("mysql2");
const pool = mysql
  .createPool({
    uri: process.env.DATABASE_URL,
  })
  .promise();

// Mexico tiene 300 distritos electorales federales. Es el universo a cubrir:
// la tabla RD solo guarda los que YA tienen responsable asignado.
const TOTAL_DISTRITOS = 300;
const VIGENCIA_MINIMA = 2026;

async function getResumenRD(req, res) {
  try {
    const [[totales]] = await pool.query(`
      SELECT
        COUNT(*)                                             AS cargados,
        COUNT(DISTINCT casa_carga)                           AS casas,
        COUNT(DISTINCT estado_norm)                          AS entidades,
        SUM(vigencia_ine IS NULL OR vigencia_ine < ?)        AS ineVencido,
        SUM(telefono IS NULL OR telefono = '')               AS sinTelefono,
        SUM(correo IS NULL OR correo = '')                   AS sinCorreo
      FROM RD
    `, [VIGENCIA_MINIMA]);

    const [porEntidad] = await pool.query(`
      SELECT estado, COUNT(*) AS cargados
      FROM RD GROUP BY estado, estado_norm ORDER BY cargados DESC, estado ASC
    `);

    const [porCasa] = await pool.query(`
      SELECT r.casa_carga AS casa, c.entidad, COUNT(*) AS cargados
      FROM RD r LEFT JOIN casas c ON c.casa = r.casa_carga
      WHERE r.casa_carga IS NOT NULL
      GROUP BY r.casa_carga, c.entidad
      ORDER BY cargados DESC, casa ASC
      LIMIT 10
    `);

    const [ultimas] = await pool.query(`
      SELECT estado, distrito_federal, nombre, apellido_paterno, usuario_subida, fecha_subida
      FROM RD ORDER BY fecha_subida DESC LIMIT 5
    `);

    const cargados = Number(totales.cargados) || 0;
    return res.json({
      totalDistritos: TOTAL_DISTRITOS,
      cargados,
      faltantes: Math.max(TOTAL_DISTRITOS - cargados, 0),
      avance: TOTAL_DISTRITOS ? Math.round((cargados / TOTAL_DISTRITOS) * 100) : 0,
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
      .json({ message: "No se pudo armar el reporte de RD", error: error.message });
  }
}

async function getListadoRD(req, res) {
  try {
    // RD son 300 filas como maximo: devolvemos todo y la grilla pagina sola.
    const [filas] = await pool.query(`
      SELECT id, estado, casa, distrito_federal, cabecera, cargo,
             apellido_paterno, apellido_materno, nombre, sexo,
             clave_elector, vigencia_ine, telefono, correo,
             calle, numero_exterior, numero_interior, colonia,
             municipio_domicilio, estado_domicilio, codigo_postal, seccion_electoral,
             casa_carga, usuario_subida, fecha_subida
      FROM RD
      ORDER BY estado ASC, distrito_federal ASC
    `);
    return res.json({ data: filas, total: filas.length });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "No se pudo traer el listado de RD", error: error.message });
  }
}

module.exports = { getResumenRD, getListadoRD };
