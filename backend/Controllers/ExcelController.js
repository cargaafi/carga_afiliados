require('dotenv').config();
const mysql = require('mysql2');
const pool = mysql.createPool(process.env.DATABASE_URL).promise();
const ExcelJS = require('exceljs');

async function readAndFilterExcel(file) {
  try {
    const workbook = new ExcelJS.Workbook();
    const data = [];

    let emptyKeyCount = 0;
    let invalidKeyCount = 0;
    //let invalidAfiliadoKeyCount = 0;
    let totalRowsWithData = 0;
    let rowsWithoutData = 0;
    let rowsWithDuplicateKeys = 0;

    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    // Conjunto para rastrear claves ya vistas
    const seenClaveElector = new Set();
    const duplicateKeys = new Set();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      let hasData = false;
      for (let i = 2; i <= 11; i++) {
        if (row.getCell(i).value !== null && row.getCell(i).value !== '') {
          hasData = true;
          break;
        }
      }

      if (!hasData) {
        rowsWithoutData++;
        continue;
      }

      const rowData = [
        row.getCell(2).value, // B: Casa
        row.getCell(3).value, // C: Clave de Elector del Afiliado
        row.getCell(4).value, // D: Apellido Paterno
        row.getCell(5).value, // E: Apellido Materno
        row.getCell(6).value, // F: Nombre
        row.getCell(7).value, // G: Teléfono
        row.getCell(8).value
          ? row.getCell(8).value.toString().trim().toUpperCase()
          : '', // H: Clave elector
        row.getCell(9).value, // I: Sección Electoral
        row.getCell(10).value, // J: Municipio
        row.getCell(11).value, // K: Entidad Federativa
      ];

      totalRowsWithData++;

      // Si es la fila problemática para Casa 11, omitirla
      if (rowNumber === 1096 && row.getCell(2).value === 11) {
        console.log(`Se omite la fila problemática ${rowNumber} para Casa 11.`);
        continue;
      }
      // eslint-disable-next-line no-lone-blocks
      {
        /*  
      
      // Validación de clave de afiliado
      const claveAfiliado = rowData[1] ? rowData[1].toString().trim() : '';
      if (!claveAfiliado || claveAfiliado.length !== 18) {
        invalidAfiliadoKeyCount++;
        continue;
      }
*/
      }
      // Validación de clave elector
      const clave = rowData[6];
      if (!clave || clave.length !== 18) {
        invalidKeyCount++;
        continue;
      }

      // Duplicados dentro del Excel
      if (seenClaveElector.has(clave)) {
        duplicateKeys.add(clave);
        rowsWithDuplicateKeys++;
        // Se descarta la fila
        continue;
      } else {
        seenClaveElector.add(clave);
        data.push(rowData);
      }
    }

    return {
      rows: data,
      stats: {
        totalRowsWithData,
        emptyKeyCount, // Nunca se incrementa, pero lo dejamos
        invalidKeyCount,
        // invalidAfiliadoKeyCount,
        rowsWithDuplicateKeys, // cuántas filas duplicadas se descartaron
        duplicateKeysCount: duplicateKeys.size,
      },
    };
  } catch (error) {
    throw new Error('Error al procesar el archivo Excel: ' + error.message);
  }
}

async function insertIntoTemp(rows, usuario) {
  let connection;
  try {
    if (!rows.length) {
      return {
        insertedCount: 0,
        duplicatesInFile: 0,
        duplicatesWithExisting: 0,
        totalDuplicatedRecords: 0,
      };
    }

    connection = await pool.getConnection();

    // 1) Truncar fuera de la transacción
    await connection.query('TRUNCATE temp_afiliados');
    console.log('Tabla truncada correctamente');

    // 2) Iniciar la transacción
    await connection.beginTransaction();

    // Insertar en temp_afiliados en chunks
    const chunkSize = 500;
    let insertedTemp = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk.map((r) => [
        r[0],
        r[1] ? r[1].toString().trim() : '',
        r[2],
        r[3],
        r[4],
        r[5],
        r[6] ? r[6].toString().trim() : '',
        r[7],
        r[8],
        r[9],
        usuario,
      ]);

      await connection.query(
        `
        INSERT INTO temp_afiliados (
            casa,
            clave_elector_afiliado,
            apellido_paterno,
            apellido_materno,
            nombre,
            telefono,
            clave_elector,
            seccion_electoral,
            municipio,
            entidad_federativa,
            usuario_subida
        ) VALUES ?
        `,
        [values]
      );
      insertedTemp += values.length;
    }

    // Contar duplicados en temp_afiliados
    const [duplicatesInFile] = await connection.query(`
      SELECT COUNT(*) AS count 
      FROM (
          SELECT clave_elector 
          FROM temp_afiliados 
          GROUP BY clave_elector 
          HAVING COUNT(*) > 1
      ) AS dups
    `);

    const [totalDuplicatedRecords] = await connection.query(`
      SELECT SUM(dup.count) AS total_registros_duplicados
      FROM (
          SELECT COUNT(*) - 1 AS count
          FROM temp_afiliados
          GROUP BY clave_elector
          HAVING COUNT(*) > 1
      ) AS dup;
    `);

    const [existingInMain] = await connection.query(`
      SELECT COUNT(*) as count
      FROM temp_afiliados t
      INNER JOIN afiliados a ON t.clave_elector = a.clave_elector
    `);

    // Insertar registros válidos en afiliados
    const [insertResult] = await connection.query(`
      INSERT INTO afiliados (
          casa,
          clave_elector_afiliado,
          apellido_paterno,
          apellido_materno,
          nombre,
          telefono,
          clave_elector,
          seccion_electoral,
          municipio,
          entidad_federativa,
          usuario_subida
      )
      SELECT DISTINCT
          t.casa,
          t.clave_elector_afiliado,
          t.apellido_paterno,
          t.apellido_materno,
          t.nombre,
          t.telefono,
          t.clave_elector,
          t.seccion_electoral,
          t.municipio,
          t.entidad_federativa,
          t.usuario_subida
      FROM temp_afiliados t
      WHERE t.clave_elector NOT IN (SELECT clave_elector FROM afiliados)
      AND t.clave_elector IN (
          SELECT clave_elector 
          FROM temp_afiliados 
          GROUP BY clave_elector 
          HAVING COUNT(*) = 1
      )
    `);

    // 3) Si todo OK, hacemos commit
    await connection.commit();
    connection.release();

    return {
      insertedCount: insertResult.affectedRows,
      duplicatesInFile: duplicatesInFile[0].count,
      duplicatesWithExisting: existingInMain[0].count,
      totalDuplicatedRecords:
        totalDuplicatedRecords[0].total_registros_duplicados || 0,
    };
  } catch (error) {
    // Si algo falla:
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
      connection.release();
    }
    throw new Error(error.message);
  }
}

async function registrarHistorialCarga(connection, casa, totalLeidos) {
  try {
    // Obtener total actual en la base principal
    const [totalRegistrosActuales] = await connection.query(
      'SELECT COUNT(*) as total FROM afiliados WHERE casa = ?',
      [casa]
    );
    
    const totalActual = totalRegistrosActuales[0].total;
    
    // Insertar registro en historial
    await connection.query(`
      INSERT INTO historial_carga (
        casa, 
        procesados, 
        total
      ) VALUES (?, ?, ?)
    `, [
      casa,
      totalLeidos,
      totalActual
    ]);
    
    return true;
  } catch (error) {
    console.error('Error al registrar historial de carga:', error);
    return false;
  }
}

async function uploadExcel(req, res) {
  let connection;
  try {
    const file = req.file;
    const usuario = req.body.usuario;

    if (!file) {
      throw new Error('No se recibió ningún archivo');
    }
    if (!usuario) {
      throw new Error('No se recibió el usuario');
    }

    // 1. Proceso de lectura y filtrado
    const { rows, stats } = await readAndFilterExcel(file);

    // 2. Proceso de inserción temporal y luego a afiliados
    const {
      insertedCount,
      duplicatesInFile,
      duplicatesWithExisting,
      totalDuplicatedRecords,
    } = await insertIntoTemp(rows, usuario);

    // Calculamos duplicados totales = duplicados de lectura + duplicados detectados en temp
    const duplicadosTotales =
      stats.rowsWithDuplicateKeys + (totalDuplicatedRecords || 0);

    // 3. Registrar en historial de carga (solo si hay registros)
    if (rows.length > 0) {
      // Obtener la casa del primer registro
      const casa = rows[0][0];
      
      // Obtener una conexión para el historial
      connection = await pool.getConnection();
      
      // Llamar a la función refactorizada
      await registrarHistorialCarga(connection, casa, stats.totalRowsWithData);
      
      connection.release();
    }

    return res.json({
      message: 'Archivo procesado correctamente.',
      totalFilasConDatos: stats.totalRowsWithData,
      claveElectorVacia: stats.emptyKeyCount,
      claveElectorInvalida: stats.invalidKeyCount,
      //claveAfiliadoInvalida: stats.invalidAfiliadoKeyCount,
      // Este es el que unifica en un solo valor
      duplicadosTotales,
      // Si quieres exponerlo aún:
      duplicadosEnArchivo: duplicatesInFile,
      duplicadosConExistentes: duplicatesWithExisting,
      insertadasExitosamente: insertedCount,
    });
  } catch (error) {
    // Liberar la conexión si existe
    if (connection) {
      connection.release();
    }
    
    return res.status(500).json({
      message: error.message || 'Error al procesar el archivo Excel.',
      error: error.toString(),
    });
  }
}

module.exports = {
  readAndFilterExcel,
  insertIntoTemp,
  uploadExcel,
};
