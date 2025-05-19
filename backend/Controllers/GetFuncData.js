require('dotenv').config();
const mysql = require('mysql2');
const pool = mysql.createPool(process.env.DATABASE_URL).promise();
const { Parser } = require('json2csv');

async function exportAfiliadosExcel__(req, res) {
  try {
    const maxChunkSize = 100000;

    // 1. Obtener total de registros
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM afiliados');
    if (total === 0) {
      return res.status(400).send('No hay datos para exportar');
    }

    const totalChunks = Math.ceil(total / maxChunkSize);
    const allRows = [];

    // 2. Obtener todos los registros en chunks
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * maxChunkSize;
      const [chunk] = await pool.query(
        'SELECT * FROM afiliados LIMIT ? OFFSET ?',
        [maxChunkSize, offset]
      );
      allRows.push(...chunk);
    }

    // 3. Generar el CSV
    const parser = new Parser({
      delimiter: ',', 
    });
    const csv = parser.parse(allRows);

    // 4. Enviar el archivo
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=Afiliados_Total.csv');
    res.status(200).send('\uFEFF' + csv);
  } catch (err) {
    console.error('Error al exportar afiliados:', err);
    res.status(500).send('Error al generar el archivo CSV');
  }
} 



async function getAfiliados___(req, res) {
  console.log('Inicio de getAfiliados___');
  
  const usuario = req.query.usuario ?? '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  try {
    // Usar el pool directamente
    const [rows] = await pool.query(
      'SELECT * FROM afiliados LIMIT ? OFFSET ?', 
      [limit, offset]
    );
    console.log(`Registros obtenidos: ${rows.length}`);
    
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM afiliados'
    );
    
    console.log('Respuesta que se enviará:', { 
      registrosEnviados: rows.length, 
      totalRegistros: total, 
      paginaActual: page 
    });
    
    res.json({ data: rows, total });
  } catch (error) {
    console.error('Error en getAfiliados:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getReporteCompleto(req, res) {
  try {
    // Usar el pool directamente para todas las consultas
    const [totalResult] = await pool.query('SELECT COUNT(*) as total FROM afiliados');
    const [userStats] = await pool.query('SELECT usuario_subida, COUNT(*) as total_registros FROM afiliados GROUP BY usuario_subida');
    const [topUsers] = await pool.query(`SELECT usuario_subida, COUNT(*) as registros, MAX(fecha_subida) as ultima_fecha FROM afiliados GROUP BY usuario_subida ORDER BY registros DESC LIMIT 10`);
    const [allUsers] = await pool.query(`SELECT usuario_subida, COUNT(*) as registros, MAX(fecha_subida) as ultima_fecha FROM afiliados GROUP BY usuario_subida ORDER BY registros DESC`);
    
    const [casaStats] = await pool.query(`SELECT casa, COUNT(*) as registros FROM afiliados GROUP BY casa ORDER BY registros DESC`);
    const [topCasas] = await pool.query(`SELECT casa, COUNT(*) as registros FROM afiliados GROUP BY casa ORDER BY registros DESC LIMIT 10`);
    
    // Procesar datos
    const totalRegistros = totalResult[0].total;
    const usuariosActivos = userStats.length;
    const casasActivas = casaStats.length;
    const promedioRegistros = usuariosActivos > 0 ? totalRegistros / usuariosActivos : 0;
    const promedioPorCasa = casasActivas > 0 ? totalRegistros / casasActivas : 0;
    
    // Añadir id para DataGrid
    allUsers.forEach((user, index) => {
      user.id = index;
    });
    
    casaStats.forEach((casa, index) => {
      casa.id = index;
    });
    
    res.json({
      estadisticas: {
        totalRegistros,
        usuariosActivos,
        promedioRegistros: Math.round(promedioRegistros),
        casasActivas,
        promedioPorCasa: Math.round(promedioPorCasa)
      },
      topUsers,
      allUsers,
      casaStats,
      topCasas
    });
  } catch (error) {
    console.error('Error en getReporteCompleto:', error);
    res.status(500).json({ error: 'Error al obtener datos del reporte' });
  }
}

async function getGraficoCasas__(req, res) {
  try {
    // Usar el pool directamente
    const [historialCasas] = await pool.query(`
      SELECT casa, procesadas, total, fecha_carga
      FROM historial_carga
      ORDER BY casa ASC
    `);
    
    const chartData = historialCasas.map(carga => ({
      casa: carga.casa,
      procesadas: carga.procesadas,
      total: carga.total,
    }));
    
    res.json({ chartData });
  } catch (error) {
    console.error('Error en getGraficoCasas:', error);
    res.status(500).json({ error: 'Error al obtener datos del gráfico' });
  }
}

async function listUsers__(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Consulta para obtener todos los usuarios
    const [result] = await connection.query(`
      SELECT * FROM users
    `);
    
    // Formato de respuesta
    const userList = result.map((row) => ({
      id: row.id,
      user: row.username,
      role: row.role,
    }));
    
    res.json(userList);
  } catch (error) {
    console.error('Error en listUsers:', error);
    res.status(500).json({ error: 'Error al recuperar usuarios de la base de datos' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  getAfiliados___,
  getGraficoCasas__,
  getReporteCompleto,
  listUsers__,
  exportAfiliadosExcel__
};
