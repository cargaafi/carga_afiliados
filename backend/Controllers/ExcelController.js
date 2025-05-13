require("dotenv").config();
const mysql = require("mysql2");
const pool = mysql
  .createPool({
    uri: process.env.DATABASE_URL,
  })
  .promise();
const ExcelJS = require("exceljs");
const progressManager = require("./Progress");

function limpiarTextoCorrupto(texto) {
  if (!texto || typeof texto !== "string") return texto;

  return texto
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ãœ/g, "Ü")
    .replace(/Ã‹/g, "Ë")
    .replace(/ÃƒÂ¡/g, "á")
    .replace(/ÃƒÂ©/g, "é")
    .replace(/ÃƒÂ­/g, "í")
    .replace(/ÃƒÂ³/g, "ó")
    .replace(/ÃƒÂº/g, "ú")
    .replace(/ÃƒÂ±/g, "ñ")
    .replace(/Ãƒâ€˜/g, "Ñ")
    .replace(/Ãƒâ€°/g, "É")
    .replace(/ÃƒÂ­a/g, "ía")
    .replace(/ÃƒÂ/g, "Á")
    .replace(/ÃƒÂ/g, "Í")
    .replace(/ÃƒÂš/g, "Ú")
    .replace(/nÌˆ/g, "ñ")
    .replace(/Ìˆ/g, "")
    .replace(/Â /g, " ");
}

async function insertIntoTempChunked(rows, usuario) {
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

    const startTime = Date.now();
    const totalRows = rows.length;

    function estimateRemainingTime(procesadosActualmente, tiempoTranscurrido) {
      const registrosPorSegundo =
        procesadosActualmente / (tiempoTranscurrido / 1000);
      const registrosRestantes = totalRows - procesadosActualmente;
      const tiempoEstimadoRestante = registrosRestantes / registrosPorSegundo;

      const minutosRestantes = Math.floor(tiempoEstimadoRestante / 60);
      const segundosRestantes = Math.round(tiempoEstimadoRestante % 60);

      progressManager.updateProgress({
        progress: Math.round((procesadosActualmente / totalRows) * 100),
        speed: registrosPorSegundo.toFixed(2),
        estimatedRemaining: {
          minutes: minutosRestantes,
          seconds: segundosRestantes,
        },
      });
    }

    // Obtener una conexión para truncar
    connection = await pool.getConnection();
    await connection.query("TRUNCATE temp_afiliados");
    console.log("Tabla truncada correctamente");
    connection.release();
    connection = null;

    const chunkSize = 1000;
    let insertedTemp = 0;
    let successfulChunks = 0;
    let failedChunks = 0;
    const maxRetries = 3;

    // Procesar cada chunk con una nueva conexión
    for (let i = 0; i < rows.length; i += chunkSize) {
      const currentTime = Date.now();
      estimateRemainingTime(insertedTemp, currentTime - startTime);

      const chunkNumber = Math.floor(i / chunkSize) + 1;
      let retries = 0;
      let success = false;

      while (!success && retries < maxRetries) {
        let chunkConnection;
        try {
          chunkConnection = await pool.getConnection();
          await chunkConnection.beginTransaction();

          const chunk = rows.slice(i, i + chunkSize);
          const values = chunk.map((r) => [
            r[0],
            r[1] ? r[1].toString().trim() : "",
            r[2],
            r[3],
            r[4],
            r[5],
            r[6] ? r[6].toString().trim() : "",
            r[7],
            r[8],
            r[9],
            usuario,
          ]);

          await chunkConnection.query(
            `INSERT INTO temp_afiliados (
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
            ) VALUES ?`,
            [values]
          );

          await chunkConnection.commit();
          chunkConnection.release();
          chunkConnection = null;

          insertedTemp += values.length;
          successfulChunks++;
          success = true;
        } catch (chunkError) {
          retries++;
          if (chunkConnection) {
            try {
              await chunkConnection.rollback();
            } catch (rollbackError) {
              console.error(
                `Error en rollback del chunk ${chunkNumber}:`,
                rollbackError
              );
            }
            try {
              chunkConnection.release();
            } catch (releaseError) {
              console.error(
                `Error liberando conexión del chunk ${chunkNumber}:`,
                releaseError
              );
            }
            chunkConnection = null;
          }

          console.error(
            `Error en chunk ${chunkNumber}, intento ${retries}:`,
            chunkError.message
          );

          if (retries >= maxRetries) {
            failedChunks++;
            console.error(
              `Chunk ${chunkNumber} falló después de ${maxRetries} intentos.`
            );
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            console.log(
              `Reintentando chunk ${chunkNumber}, intento ${retries + 1}...`
            );
          }
        }
      }
    }

    console.log(
      `Proceso de chunks completado: ${successfulChunks} exitosos, ${failedChunks} fallidos, ${insertedTemp} registros totales`
    );

    // Obtener nueva conexión para estadísticas
    let statsConnection;
    try {
      statsConnection = await pool.getConnection();

      const [duplicatesInFile] = await statsConnection.query(`
        SELECT COUNT(*) AS count 
        FROM (
            SELECT clave_elector 
            FROM temp_afiliados 
            GROUP BY clave_elector 
            HAVING COUNT(*) > 1
        ) AS dups
      `);

      const [totalDuplicatedRecords] = await statsConnection.query(`
        SELECT SUM(dup.count) AS total_registros_duplicados
        FROM (
            SELECT COUNT(*) - 1 AS count
            FROM temp_afiliados
            GROUP BY clave_elector
            HAVING COUNT(*) > 1
        ) AS dup;
      `);

      const [existingInMain] = await statsConnection.query(`
        SELECT COUNT(*) as count
        FROM temp_afiliados t
        INNER JOIN afiliados a ON t.clave_elector = a.clave_elector
      `);

      // Inserción final
      await statsConnection.beginTransaction();

      const [insertResult] = await statsConnection.query(`
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

      await statsConnection.commit();

      progressManager.updateProgress({
        progress: 100,
        speed: 0,
        estimatedRemaining: {
          minutes: 0,
          seconds: 0,
        },
      });

      return {
        insertedCount: insertResult.affectedRows,
        duplicatesInFile: duplicatesInFile[0].count,
        duplicatesWithExisting: existingInMain[0].count,
        totalDuplicatedRecords:
          totalDuplicatedRecords[0].total_registros_duplicados || 0,
        successfulChunks,
        failedChunks,
      };
    } finally {
      if (statsConnection) {
        try {
          statsConnection.release();
        } catch (releaseError) {
          console.error(
            "Error liberando conexión de estadísticas:",
            releaseError
          );
        }
      }
    }
  } catch (error) {
    // Liberar cualquier conexión pendiente
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error("Error liberando conexión principal:", releaseError);
      }
    }
    throw new Error(`Error procesando datos: ${error.message}`);
  }
}
async function processInsert(rows, usuario) {
  // Determinar si es un archivo grande basado en la cantidad de registros
  const isLargeFile = rows.length > 30000;

  if (isLargeFile) {
    console.log(
      `Archivo grande (${rows.length} registros): usando transacciones por chunk`
    );
    return await insertIntoTempChunked(rows, usuario);
  } else {
    console.log(
      `Archivo regular (${rows.length} registros): usando transacción única`
    );
    return await insertIntoTemp(rows, usuario);
  }
}

function validarCamposAfiliado(rowData, rowNumber) {
  const errores = [];

  // Definición de restricciones para cada campo
  const restricciones = {
    casa: {
      maxLength: 2,
      tipo: "char",
      indice: 0,
      nombre: "Casa",
      requerido: true,
    },
    claveElectorAfiliado: {
      maxLength: 50,
      tipo: "varchar",
      indice: 1,
      nombre: "Clave de Elector del Afiliado",
    },
    apellidoPaterno: {
      maxLength: 250,
      tipo: "varchar",
      indice: 2,
      nombre: "Apellido Paterno",
    },
    apellidoMaterno: {
      maxLength: 250,
      tipo: "varchar",
      indice: 3,
      nombre: "Apellido Materno",
    },
    nombre: { maxLength: 250, tipo: "varchar", indice: 4, nombre: "Nombre" },
    telefono: { maxLength: 20, tipo: "varchar", indice: 5, nombre: "Teléfono" },
    seccionElectoral: {
      length: 4,
      tipo: "char",
      indice: 7,
      nombre: "Sección Electoral",
    },
    municipio: {
      maxLength: 250,
      tipo: "varchar",
      indice: 8,
      nombre: "Municipio",
    },
    entidadFederativa: {
      maxLength: 250,
      tipo: "varchar",
      indice: 9,
      nombre: "Entidad Federativa",
    },
  };

  // Validar cada campo según sus restricciones
  Object.keys(restricciones).forEach((campo) => {
    const restriccion = restricciones[campo];
    const valor = rowData[restriccion.indice];
    const valorStr = valor ? valor.toString().trim() : "";

    // Verificar si es un campo requerido
    if (restriccion.requerido && !valorStr) {
      errores.push({
        fila: rowNumber,
        campo: restriccion.nombre,
        valor: valorStr,
        mensaje: `El campo ${restriccion.nombre} es requerido y no puede estar vacío`,
      });
      return; // Continuar con el siguiente campo
    }
    // Validar longitud máxima (para campos tipo varchar)
    if (
      restriccion.maxLength &&
      valorStr &&
      valorStr.length > restriccion.maxLength
    ) {
      errores.push({
        fila: rowNumber,
        campo: restriccion.nombre,
        valor: valorStr,
        mensaje: `El campo ${restriccion.nombre} excede la longitud máxima de ${restriccion.maxLength} caracteres`,
      });
    }
  });

  return errores;
}

async function readAndFilterExcel(file) {
  try {
    const workbook = new ExcelJS.Workbook();
    const data = [];
    const erroresDetallados = [];

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
        if (row.getCell(i).value !== null && row.getCell(i).value !== "") {
          hasData = true;
          break;
        }
      }

      if (!hasData) {
        rowsWithoutData++;
        continue;
      }

  const rowData = [
      row.getCell(2).value, // B: Casa (sin limpiar)
      row.getCell(3).value, // C: Clave de Elector del Afiliado (sin limpiar)
      limpiarTextoCorrupto(row.getCell(4).value?.toString().trim()), // D: Apellido Paterno
      limpiarTextoCorrupto(row.getCell(5).value?.toString().trim()), // E: Apellido Materno
      limpiarTextoCorrupto(row.getCell(6).value?.toString().trim()), // F: Nombre
      row.getCell(7).value?.toString().trim(), // G: Teléfono (sin limpiar)
      row.getCell(8) ? row.getCell(8).value.toString().trim().toUpperCase() : '', // H: Clave elector (sin limpiar)
      row.getCell(9).value, // I: Sección Electoral (sin limpiar)
      limpiarTextoCorrupto(row.getCell(10).value?.toString().trim()), // J: Municipio
      limpiarTextoCorrupto(row.getCell(11).value?.toString().trim()), // K: Entidad Federativa
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

      // AQUÍ: Validar todos los campos de la fila
      const erroresFila = validarCamposAfiliado(rowData, rowNumber);
      if (erroresFila.length > 0) {
        erroresDetallados.push(...erroresFila);
        continue; // Saltar esta fila si tiene errores
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

    // Estructurar errores para el frontend
    let mensajeErrores = "";
    if (erroresDetallados.length > 0) {
      mensajeErrores = "Se encontraron los siguientes errores:\n";
      erroresDetallados.forEach((error) => {
        mensajeErrores += `Fila ${error.fila}: ${error.mensaje} (valor: "${error.valor}")\n`;
      });
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
      tieneErrores: erroresDetallados.length > 0,
      mensajeErrores: mensajeErrores,
      erroresDetallados: erroresDetallados,
    };
  } catch (error) {
    throw new Error("Error al procesar el archivo Excel: " + error.message);
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
    await connection.query("TRUNCATE temp_afiliados");
    console.log("Tabla truncada correctamente");

    // 2) Iniciar la transacción
    await connection.beginTransaction();

    // Insertar en temp_afiliados en chunks
    const chunkSize = 2400;
    let insertedTemp = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk.map((r) => [
        r[0],
        r[1] ? r[1].toString().trim() : "",
        r[2],
        r[3],
        r[4],
        r[5],
        r[6] ? r[6].toString().trim() : "",
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
        console.error("Error en rollback:", rollbackError);
      }
      connection.release();
    }
    throw new Error(error.message);
  }
}

async function registrarHistorialCarga(connection, casa, totalLeidos) {
  try {
    // Total actual en la base principal
    const [totalRegistrosActuales] = await connection.query(
      "SELECT COUNT(*) as total FROM afiliados WHERE casa = ?",
      [casa]
    );

    const totalActual = totalRegistrosActuales[0].total;

    // Insertar o actualizar registro en historial
    await connection.query(
      `
      INSERT INTO historial_carga (
        casa, 
        procesadas, 
        total,
        fecha_carga
      ) VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        procesadas = VALUES(procesadas),
        total = VALUES(total),
        fecha_carga = NOW()
    `,
      [casa, totalLeidos, totalActual]
    );

    return true;
  } catch (error) {
    console.error("Error al registrar historial de carga:", error);
    return false;
  }
}

async function uploadExcel(req, res) {
  let connection;
  try {
    const file = req.file;
    const usuario = req.body.usuario;

    if (!file) {
      throw new Error("No se recibió ningún archivo");
    }
    if (!usuario) {
      throw new Error("No se recibió el usuario");
    }

    // 1. Proceso de lectura y filtrado
    const { rows, stats, tieneErrores, mensajeErrores, erroresDetallados } =
      await readAndFilterExcel(file);

    // Verificar si hay errores de validación y detener el proceso si los hay
    if (tieneErrores) {
      console.log("ERRORES DE VALIDACIÓN ENCONTRADOS:", mensajeErrores);
      return res.status(400).json({
        message: "Existen errores en el archivo que impiden su procesamiento.",
        tieneErrores: true,
        mensajeErrores: mensajeErrores,
        erroresDetallados: erroresDetallados,
      });
    }

    // 2. Proceso de inserción temporal y luego a afiliados
    const {
      insertedCount,
      duplicatesInFile,
      duplicatesWithExisting,
      totalDuplicatedRecords,
    } = await processInsert(rows, usuario);

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
      message: "Archivo procesado correctamente.",
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
      message: error.message || "Error al procesar el archivo Excel.",
      error: error.toString(),
    });
  }
}

module.exports = {
  readAndFilterExcel,
  insertIntoTemp,
  uploadExcel,
};
