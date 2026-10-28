require("dotenv").config();
const mysql = require("mysql2");
const { resolverUsuario } = require("./RDController");
const pool = mysql
  .createPool({
    uri: process.env.DATABASE_URL,
  })
  .promise();

// Mexico tiene 300 distritos electorales federales. Es el universo a cubrir:
// la tabla RD solo guarda los que YA tienen responsable asignado.
const TOTAL_DISTRITOS = 300;
// El año en curso: una credencial vale hasta el final del año que indica.
const vigenciaMinima = () => new Date().getFullYear();

// Cada casa ve SOLO lo que subió ella (aislado incluso de otras casas de su
// misma entidad: CDMX tiene 5, Estado de México 2, etc. - antes compartian
// vista por entidad y dos casas distintas se veian entre si). El usuario
// nacional sigue viendo el pais entero. Se resuelve desde el token, nunca
// desde algo que mande el navegador.
//
// Excepcion: las filas que subio el propio usuario nacional (casa_carga
// queda NULL, el admin no tiene numero de casa) se muestran igual a la casa
// de esa entidad, porque si no una correccion del nacional quedaria
// invisible para todos - nadie la veria nunca.
async function alcanceDe(req) {
  const usuario = await resolverUsuario(req.user && req.user.id);
  if (!usuario) return null;
  if (usuario.nacional) {
    return { nacional: true, where: "", params: [], entidad: "Todas" };
  }
  if (!usuario.entidad_norm || usuario.casa === null) {
    // usuario sin casa asociada: no ve nada, en vez de ver todo
    return { nacional: false, where: "WHERE 1 = 0", params: [], entidad: null };
  }
  return {
    nacional: false,
    where: "WHERE (casa_carga = ? OR (casa_carga IS NULL AND estado_norm = ?))",
    params: [String(usuario.casa), usuario.entidad_norm],
    entidad: usuario.entidad,
    casa: usuario.casa,
  };
}

async function getResumenRD(req, res) {
  try {
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    const [[totales]] = await pool.query(`
      SELECT
        COUNT(*)                                             AS cargados,
        COUNT(DISTINCT casa_carga)                           AS casas,
        COUNT(DISTINCT estado_norm)                          AS entidades,
        SUM(vigencia_ine IS NULL OR vigencia_ine < ?)        AS ineVencido,
        SUM(telefono IS NULL OR telefono = '')               AS sinTelefono,
        SUM(correo IS NULL OR correo = '')                   AS sinCorreo
      FROM RD ${a.where}
    `, [vigenciaMinima(), ...a.params]);

    const [porEntidad] = await pool.query(`
      SELECT estado, COUNT(*) AS cargados
      FROM RD ${a.where}
      GROUP BY estado, estado_norm ORDER BY cargados DESC, estado ASC
    `, a.params);

    const [porCasa] = await pool.query(`
      SELECT r.casa_carga AS casa, c.entidad, COUNT(*) AS cargados
      FROM RD r LEFT JOIN casas c ON c.casa = r.casa_carga
      ${a.where ? a.where + " AND" : "WHERE"} r.casa_carga IS NOT NULL
      GROUP BY r.casa_carga, c.entidad
      ORDER BY cargados DESC, casa ASC
      LIMIT 10
    `, a.params);

    const [ultimas] = await pool.query(`
      SELECT estado, distrito_federal, nombre, apellido_paterno, usuario_subida, fecha_subida
      FROM RD ${a.where} ORDER BY fecha_subida DESC LIMIT 5
    `, a.params);

    const cargados = Number(totales.cargados) || 0;
    // El universo de 300 distritos solo tiene sentido a nivel nacional: no
    // sabemos cuantos distritos tiene cada entidad, asi que para una casa se
    // informa el total cargado sin porcentaje inventado.
    return res.json({
      nacional: a.nacional,
      entidadUsuario: a.entidad,
      totalDistritos: a.nacional ? TOTAL_DISTRITOS : null,
      cargados,
      faltantes: a.nacional ? Math.max(TOTAL_DISTRITOS - cargados, 0) : null,
      avance: a.nacional ? Math.round((cargados / TOTAL_DISTRITOS) * 100) : null,
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
    const a = await alcanceDe(req);
    if (!a) return res.status(401).json({ message: "Usuario no válido" });

    // RD son 300 filas como maximo: devolvemos todo y la grilla pagina sola.
    const [filas] = await pool.query(`
      SELECT id, estado, casa, distrito_federal, cabecera, cargo,
             apellido_paterno, apellido_materno, nombre, sexo,
             clave_elector, vigencia_ine, telefono, correo,
             calle, numero_exterior, numero_interior, colonia,
             municipio_domicilio, estado_domicilio, codigo_postal, seccion_electoral,
             casa_carga, usuario_subida, fecha_subida
      FROM RD ${a.where}
      ORDER BY estado ASC, distrito_federal ASC
    `, a.params);
    return res.json({ data: filas, total: filas.length, nacional: a.nacional });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "No se pudo traer el listado de RD", error: error.message });
  }
}

module.exports = { getResumenRD, getListadoRD };
