require('dotenv').config();
const mysql = require('mysql2');
const pool = mysql.createPool(process.env.DATABASE_URL).promise();



async function getAfiliados___(req, res) {
  let connection;
  console.log('Inicio de getAfiliados___');
  const usuario = req.query.usuario ?? '';

  try {
      console.log('Obteniendo conexión...');
      connection = await pool.getConnection();
      
      console.log('Ejecutando query...');
      const [rows] = await connection.query(
          'SELECT * FROM afiliados',
          
      );
      console.log('Rows obtenidas:', rows.length);
      res.json(rows);

  } catch (error) {
      console.error('Error en getAfiliados:', error);
      res.status(500).json({ error: error.message });
  } finally {
      if (connection) {
          console.log('Liberando conexión...');
          connection.release();
      }
  }
}

async function getReporteCompleto(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Una sola transacción para todas las consultas
    await connection.beginTransaction();
    
    // Consultas originales
    const [totalResult] = await connection.query('SELECT COUNT(*) as total FROM afiliados');
    const [userStats] = await connection.query('SELECT usuario_subida, COUNT(*) as total_registros FROM afiliados GROUP BY usuario_subida');
    const [topUsers] = await connection.query(`SELECT usuario_subida, COUNT(*) as registros, MAX(fecha_subida) as ultima_fecha FROM afiliados GROUP BY usuario_subida ORDER BY registros DESC LIMIT 10`);
    const [allUsers] = await connection.query(`SELECT usuario_subida, COUNT(*) as registros, MAX(fecha_subida) as ultima_fecha FROM afiliados GROUP BY usuario_subida ORDER BY registros DESC`);
    
    // Nueva consulta por casa
    const [casaStats] = await connection.query(`SELECT casa, COUNT(*) as registros FROM afiliados GROUP BY casa ORDER BY registros DESC`);
    const [topCasas] = await connection.query(`SELECT casa, COUNT(*) as registros FROM afiliados GROUP BY casa ORDER BY registros DESC LIMIT 10`);
    
    await connection.commit();
    
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
    
    // Devolver todo en una respuesta
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
    
    // Verificar si la conexión sigue abierta antes de hacer rollback
    if (connection && connection.connection && !connection.connection._closing) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al hacer rollback:', rollbackError);
        // No relanzo este error para que no oculte el error original
      }
    }
    
    res.status(500).json({ error: 'Error al obtener datos del reporte' });
  } finally {
    // Asegurarse de liberar la conexión incluso si hay errores
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error al liberar la conexión:', releaseError);
      }
    }
  }
}


async function getGraficoCasas__(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();

    // Consulta para obtener el número de registros por cada casa
    const [casaStats] = await connection.query(`
      SELECT casa, COUNT(*) as registros
      FROM afiliados
      GROUP BY casa
      ORDER BY registros DESC
    `);

    // Formato de respuesta
    const chartData = casaStats.map((casa) => ({
      casa: casa.casa,
      registros: casa.registros,
    }));

    res.json({ chartData });
  } catch (error) {
    console.error('Error en getGraficoCasas:', error);
    res.status(500).json({ error: 'Error al obtener datos del gráfico' });
  } finally {
    if (connection) {
      connection.release();
    }
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
  listUsers__
};
