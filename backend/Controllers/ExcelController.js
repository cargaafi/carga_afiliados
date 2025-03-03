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
    let invalidAfiliadoKeyCount = 0;
    let totalRowsWithData = 0;

    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      let hasData = false;
      for (let i = 2; i <= 11; i++) {
        if (row.getCell(i).value !== null && row.getCell(i).value !== '') {
          hasData = true;
          break;
        }
      }

      if (!hasData) continue;

      const rowData = [
        row.getCell(2).value, // B: Casa
        row.getCell(3).value, // C: Clave de Elector del Afiliado
        row.getCell(4).value, // D: Apellido Paterno
        row.getCell(5).value, // E: Apellido Materno
        row.getCell(6).value, // F: Nombre
        row.getCell(7).value, // G: Teléfono
        row.getCell(8).value, // H: Clave de Elector (PRIMARY KEY)
        row.getCell(9).value, // I: Sección Electoral
        row.getCell(10).value, // J: Municipio
        row.getCell(11).value, // K: Entidad Federativa
      ];

      totalRowsWithData++;

      const claveAfiliado = rowData[1] ? rowData[1].toString().trim() : ''; // Eliminamos espacios
      
      if (!claveAfiliado || claveAfiliado.length !== 18) {
          invalidAfiliadoKeyCount++;
          continue;
      }
      
      const clave = rowData[6] ? rowData[6].toString().trim() : ''; // Eliminamos espacios
      if (!clave || clave.length !== 18) {
          invalidKeyCount++;
          continue;
      }
      

      if (clave.toString().length !== 18) {
        invalidKeyCount++;
        continue;
      }

      data.push(rowData);
    }

    return {
      rows: data,
      stats: {
        totalRowsWithData,
        emptyKeyCount,
        invalidKeyCount,
        invalidAfiliadoKeyCount,
      },
    };
  } catch (error) {
    console.error('Error en readAndFilterExcel:', error);
    throw new Error('Error al procesar el archivo Excel: ' + error.message);
  }
}

async function insertIntoTemp(rows, usuario) {
  let connection;
  try {
    if (!rows.length) {
      return {
        insertedCount: 0,
        duplicateCount: 0,
        duplicatesInFile: 0,
      };
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Limpiar tabla temporal
 await connection.query('TRUNCATE TABLE temp_afiliados');

    // 2. Insertar en temp_afiliados en chunks
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

    // 3. Obtener estadísticas
    const [duplicatesInFile] = await connection.query(`
          SELECT COUNT(*) as count 
          FROM (
              SELECT clave_elector 
              FROM temp_afiliados 
              GROUP BY clave_elector 
              HAVING COUNT(*) > 1
          ) as dups
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

    // 4. Insertar registros válidos en tabla principal
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

    await connection.commit();

    return {
      insertedCount: insertResult.affectedRows,
      duplicatesInFile: duplicatesInFile[0].count,
      duplicatesWithExisting: existingInMain[0].count,
      totalDuplicatedRecords: totalDuplicatedRecords[0].total_registros_duplicados || 0, // Agregado
  };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error en insertIntoTemp:', error);
    throw new Error(
      'Error al procesar los datos en la tabla temporal: ' + error.message
    );
  } finally {
    if (connection) {
     await connection.query('TRUNCATE TABLE temp_afiliados');
      connection.release();
    }
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

    // 1. Validaciones de formato del Excel
    const { rows, stats } = await readAndFilterExcel(file);

    // 2. Proceso con tabla temporal
    const { insertedCount, duplicatesInFile, duplicatesWithExisting, totalDuplicatedRecords } =
      await insertIntoTemp(rows, usuario);

      return res.json({
        message: 'Archivo procesado correctamente.',
        totalFilasConDatos: stats.totalRowsWithData,
        claveElectorVacia: stats.emptyKeyCount,
        claveElectorInvalida: stats.invalidKeyCount,
        claveAfiliadoInvalida: stats.invalidAfiliadoKeyCount,
        duplicadosEnArchivo: duplicatesInFile,
        duplicadosConExistentes: duplicatesWithExisting,
        insertadasExitosamente: insertedCount,
        totalRepetidosSumados: totalDuplicatedRecords, // Nuevo campo
    });
  } catch (error) {
    console.error('Error en uploadExcel:', error);
    return res.status(500).json({
      message:
        error.message ||
        'Error al procesar el archivo Excel. Intente de nuevo.',
      error: error.toString(),
    });
  }
}

module.exports = {
  readAndFilterExcel,
  insertIntoTemp,
  uploadExcel,
};
