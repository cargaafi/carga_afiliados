// Carga de Responsables Generales (RG): mismas reglas que RD, pero con tabla de paso + lotes por el volumen (173.396 filas).
const fs = require("fs");
const crypto = require("crypto");
const V = require("./validaciones");
const { filasDeHoja, recorrerHoja, nombresDeHojas } = require("./lectorExcel");
const progressManager = require("./Progress");

const pool = V.pool;
const HOJA_RG = "RG";

// Encabezados esperados de la hoja RG en su posicion exacta; se comparan los 29 para no dejar pasar columnas cruzadas.
const ENCABEZADOS_RG = [
  "SECCION ELECTORAL",
  "TIPO DE SECCION",
  "TIPO DE CASILLA (B,C, S,E)",
  "CASILLA",
  "ESTADO",
  "CASA",
  "CIRCUNSCRIPCION",
  "DISTRITO ELECTORAL FEDERAL",
  "CABECERA",
  "MUNICIPIO",
  "DISTRITO ELECTORAL LOCAL",
  "CABECERA",
  "CARGO",
  "APELLIDO PATERNO",
  "APELLIDO MATERNO",
  "NOMBRE(S)",
  "SEXO",
  "CLAVE DE ELECTOR",
  "FECHA DE VIGENCIA INE",
  "TELEFONO",
  "CORREO ELECTRONICO",
  "CALLE",
  "NUMERO EXTERIOR",
  "NUMERO INTERIOR",
  "COLONIA",
  "MUNICIPIO",
  "ESTADO",
  "CODIGO POSTAL",
  "SECCION ELECTORAL",
];

// Letra de columna a partir del indice: 1 -> A, 14 -> N, 29 -> AC
function letraColumna(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - r - 1) / 26;
  }
  return s;
}

// Devuelve null si el encabezado es correcto, o el texto del primer problema encontrado.
function problemaDeFirma(valores) {
  for (let i = 0; i < ENCABEZADOS_RG.length; i++) {
    const col = i + 1;
    const esperado = ENCABEZADOS_RG[i];
    const vino = V.norm(valores[col]);
    if (vino !== esperado) {
      return (
        `la columna ${letraColumna(col)} debería decir "${esperado}" ` +
        (vino ? `y dice "${vino}"` : "y está vacía")
      );
    }
  }
  return null;
}

// Una fila "con responsable" tiene alguna celda de la N en adelante sin autocerrar (<c .../> = vacia).
const TIENE_PERSONA = /<c r="(?:N|O|P|Q|R|S|T|U|V|W|X|Y|Z|AA|AB|AC|AD)\d+"[^>]*[^/]>/;

const MAX_FILAS_ENCABEZADO = 8;
const TAMANO_LOTE = 1000;

// Topes del detalle que viaja al navegador.
const MAX_DETALLE = 2000;
const MAX_DETALLE_AJENAS = 100;

// Reintentos de la fase de escritura cuando dos cargas se traban entre si.
const MAX_REINTENTOS = 4;

// Columnas A..M de RG. Se sellan en la primera carga, igual que en RD.
const COLUMNAS_UBICACION = [
  "seccion_electoral_ubic",
  "tipo_seccion",
  "tipo_casilla",
  "casilla",
  "estado",
  "estado_norm",
  "casa",
  "circunscripcion",
  "distrito_federal",
  "cabecera_federal",
  "municipio",
  "distrito_local",
  "cabecera_local",
  "cargo",
];

const COLUMNAS_TEMP = [
  "carga_id",
  "fila_excel",
  ...COLUMNAS_UBICACION,
  ...V.COLUMNAS_PERSONA,
];

function mapearFilaRG(valores) {
  const c = (i) => V.txt(valores[i]);
  const estado = c(5);
  return {
    seccion_electoral_ubic: V.padNum(valores[1], 4),
    tipo_seccion: c(2) || null,
    tipo_casilla: V.norm(valores[3]) || null,
    casilla: V.norm(valores[4]) || null,
    estado,
    estado_norm: V.entidadCanonica(estado),
    casa: c(6) || null,
    circunscripcion: V.num(valores[7]),
    distrito_federal: V.num(valores[8]),
    cabecera_federal: c(9) || null,
    municipio: c(10) || null,
    distrito_local: V.num(valores[11]),
    cabecera_local: c(12) || null,
    cargo: c(13) || null,
    ...V.mapearPersona(valores),
  };
}

function coincideFirma(valores) {
  return problemaDeFirma(valores) === null;
}

// Error de archivo, no del servidor: se responde 400 y no 500.
function errorDeArchivo(mensaje) {
  const e = new Error(mensaje);
  e.estado = 400;
  return e;
}

// Devuelve en que fila esta el encabezado, para empezar a leer datos recien despues.
async function filaDeEncabezado(ruta) {
  const hojas = await nombresDeHojas(ruta);
  if (!hojas.includes(HOJA_RG)) {
    throw errorDeArchivo(
      `El archivo no tiene la hoja "RG". Tiene: ${hojas.join(", ")}. ` +
        `Sube el Excel de Responsables Generales.`
    );
  }
  let fila = 0;
  // Guarda el problema del candidato mas cercano, para dar un mensaje especifico en vez de uno generico.
  let mejorProblema = null;
  await recorrerHoja(
    ruta,
    HOJA_RG,
    (valores, nro) => {
      if (nro > MAX_FILAS_ENCABEZADO) return false;
      const problema = problemaDeFirma(valores);
      if (problema === null) {
        fila = nro;
        return false;
      }
      // la fila con mas celdas llenas es la que intentaba ser el encabezado
      const llenas = valores.filter((v) => v !== undefined && v !== "").length;
      if (!mejorProblema || llenas > mejorProblema.llenas)
        mejorProblema = { llenas, texto: problema };
    },
    { maxColumna: 40 }
  );
  if (!fila) {
    throw errorDeArchivo(
      'La hoja "RG" no tiene las columnas de la plantilla' +
        (mejorProblema ? `: ${mejorProblema.texto}.` : ".") +
        " Revisa que no se hayan movido, renombrado ni agregado columnas."
    );
  }
  return fila;
}

async function uploadRG(req, res) {
  const arranque = Date.now();
  const cargaId = crypto.randomUUID();
  let conexion;

  try {
    if (!req.file) throw new Error("No se recibió ningún archivo");

    const usuario = await V.resolverUsuario(req.user && req.user.id);
    if (!usuario) return res.status(401).json({ message: "Usuario no válido" });
    if (!usuario.nacional && !usuario.entidad_norm) {
      return res.status(403).json({
        message:
          `Tu usuario (${usuario.username}) no está asociado a ninguna casa, así que no puedes cargar. ` +
          `El nombre de usuario tiene que ser del tipo "Casa_14".`,
      });
    }

    const filaEncabezado = await filaDeEncabezado(req.file.path);
    const mapaCasas = await V.casasPorEntidad();

    const resumen = {
      filasLeidas: 0,
      sinResponsable: 0,
      nuevos: 0,
      actualizados: 0,
      reemplazados: 0,
      sinCambios: 0,
      descartados: {
        claveInvalida: 0,
        sinCasilla: 0,
        otroEstado: 0,
        repetidaEnArchivo: 0,
        datosIncompletos: 0,
      },
      avisos: { sexo: 0, correo: 0 },
      entidadUsuario: usuario.nacional ? "Todas" : usuario.entidad,
      detalle: [],
      avisosDetalle: [],
      cambios: [],
      segundos: 0,
    };
    // Errores casi todos listados; filas de otras casas con tope chico (no son error, pasa siempre con el archivo completo).
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
      resumen.detalle.push({ fila, motivo, ajena: esAjena || undefined });
    };
    const agregarAviso = (fila, d, texto) => {
      if (resumen.avisosDetalle.length < MAX_DETALLE)
        resumen.avisosDetalle.push({
          fila,
          distrito: `sección ${d.seccion_electoral_ubic} · casilla ${d.casilla}`,
          texto,
        });
    };

    // 1) leer + filtrar en memoria, e ir mandando lotes a la temporal
    progressManager.updateProgress({ progress: 0, speed: 0, estimatedRemaining: { minutes: 0, seconds: 0 } }, usuario.id);

    let lote = [];
    const vistas = new Set(); // llaves ya vistas en ESTE archivo
    let escritas = 0;
    let ultimoAviso = Date.now();

    const vaciarLote = async () => {
      if (!lote.length) return;
      const filas = lote;
      lote = [];
      await pool.query(
        `INSERT INTO temp_RG (${COLUMNAS_TEMP.join(", ")}) VALUES ?`,
        [filas]
      );
      escritas += filas.length;
    };

    // Cronometro propio para la velocidad: "arranque" incluye trabajo previo a leer, que inflaria la ETA.
    const inicioLectura = Date.now();

    for await (const f of filasDeHoja(req.file.path, HOJA_RG, {
      maxColumna: 40,
      desdeFila: filaEncabezado + 1,
      // De acá sale la velocidad: una fila sin nada de la N en adelante ni siquiera se parsea.
      filtroRapido: (xml) => TIENE_PERSONA.test(xml),
    })) {
      resumen.filasLeidas++;
      const nro = f.nro;
      const d = mapearFilaRG(f.valores);

      if (V.filaSinResponsable(d)) {
        resumen.sinResponsable++;
        continue;
      }
      if (!d.estado_norm || !d.seccion_electoral_ubic || !d.casilla) {
        resumen.descartados.sinCasilla++;
        agregarDetalle(nro, "sin estado, sección o casilla");
        continue;
      }
      if (!usuario.nacional && d.estado_norm !== usuario.entidad_norm) {
        resumen.descartados.otroEstado++;
        agregarDetalle(
          nro,
          `sección ${d.seccion_electoral_ubic} · casilla ${d.casilla} — corresponde ` +
            `${V.frasePertenencia(mapaCasas, d.estado_norm)}, no a la casa ${usuario.casa}`,
          true // es de otra casa: tope aparte
        );
        continue;
      }
      if (!V.claveElectorValida(d.clave_elector)) {
        resumen.descartados.claveInvalida++;
        agregarDetalle(nro, V.motivoClaveInvalida(d.clave_elector));
        continue;
      }

      // Vigencia, telefono y codigo postal son obligatorios; si falta alguno la fila no se sube.
      const motivosDatos = V.motivosDescarteDatos(d);
      if (motivosDatos.length) {
        resumen.descartados.datosIncompletos++;
        agregarDetalle(nro, motivosDatos.map((m) => m.texto).join(" · "));
        continue;
      }

      // misma casilla dos veces en el mismo archivo: gana la ultima y se avisa
      const llave = `${d.estado_norm}|${d.seccion_electoral_ubic}|${d.tipo_casilla}|${d.casilla}`;
      if (vistas.has(llave)) {
        resumen.descartados.repetidaEnArchivo++;
        agregarDetalle(
          nro,
          `la casilla ${d.casilla} de la sección ${d.seccion_electoral_ubic} viene repetida en el archivo — se toma la última`
        );
      }
      vistas.add(llave);

      const avisos = V.motivosAviso(d);
      for (const m of avisos) resumen.avisos[m.tipo]++;
      if (avisos.length) agregarAviso(nro, d, avisos.map((a) => a.texto).join(" · "));

      lote.push([
        cargaId,
        nro,
        ...COLUMNAS_UBICACION.map((c) => d[c] ?? null),
        ...V.COLUMNAS_PERSONA.map((c) => d[c] ?? null),
      ]);

      // Los lotes se escriben EN ORDEN: si una casilla viene repetida, la ultima del archivo es la que queda.
      if (lote.length >= TAMANO_LOTE) {
        await vaciarLote();
        if (Date.now() - ultimoAviso > 400) {
          ultimoAviso = Date.now();
          const transcurrido = (Date.now() - inicioLectura) / 1000;
          const porSegundo = escritas / Math.max(transcurrido, 0.1);
          const avance = f.totalBytes
            ? Math.round((f.bytesLeidos / f.totalBytes) * 95)
            : 0;
          // ETA por BYTES leidos del archivo entero (no por filas propias), y recien despues de 1s para no arrancar con una muestra contaminada.
          let estimatedRemaining = { minutes: 0, seconds: 0 };
          if (transcurrido > 1) {
            const bytesPorSegundo = f.bytesLeidos / transcurrido;
            const bytesRestantes = Math.max((f.totalBytes || 0) - f.bytesLeidos, 0);
            const segundosRestantes = bytesRestantes / Math.max(bytesPorSegundo, 1);
            estimatedRemaining = {
              minutes: Math.floor(segundosRestantes / 60),
              seconds: Math.round(segundosRestantes % 60),
            };
          }
          progressManager.updateProgress({
            progress: Math.min(avance, 95),
            speed: porSegundo.toFixed(2),
            estimatedRemaining,
          }, usuario.id);
        }
      }
    }

    await vaciarLote();

    // Falta escribir en la tabla definitiva (puede tardar mas que la lectura), por eso este aviso intermedio.
    progressManager.updateProgress(
      { progress: 96, speed: "0.00", estimatedRemaining: { minutes: 0, seconds: 0 }, fase: "guardando" },
      usuario.id
    );

    // 2) contar y escribir
    const JOIN = `
      r.estado_norm = t.estado_norm
      AND r.seccion_electoral_ubic = t.seccion_electoral_ubic
      AND r.tipo_casilla = t.tipo_casilla
      AND r.casilla = t.casilla`;

    // Si la casilla vino repetida en el archivo, se borra antes de escribir (y no como subconsulta correlacionada: bloqueaba demasiado con varias cargas a la vez).
    if (resumen.descartados.repetidaEnArchivo > 0) {
      await pool.query(
        `DELETE vieja FROM temp_RG vieja
           JOIN temp_RG nueva
             ON nueva.carga_id = vieja.carga_id
            AND nueva.estado_norm = vieja.estado_norm
            AND nueva.seccion_electoral_ubic = vieja.seccion_electoral_ubic
            AND nueva.tipo_casilla = vieja.tipo_casilla
            AND nueva.casilla = vieja.casilla
            AND nueva.fila_excel > vieja.fila_excel
         WHERE vieja.carga_id = ?`,
        [cargaId]
      );
    }

    // Cargas simultaneas en RG provocan interbloqueos (candados sobre el indice unico); por eso reintenta.
    let conteos, upd;
    for (let intento = 1; ; intento++) {
      try {
        conexion = await pool.getConnection();
        // READ COMMITTED en vez de REPEATABLE READ: evita que el INSERT...SELECT bloquee filas de otras cargas.
        await conexion.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        await conexion.beginTransaction();
        ({ conteos, upd } = await escribir(conexion));
        await conexion.commit();
        break;
      } catch (e) {
        if (conexion) {
          try { await conexion.rollback(); } catch (_) {}
          conexion.release();
          conexion = null;
        }
        const trabado = e.code === "ER_LOCK_DEADLOCK" || e.code === "ER_LOCK_WAIT_TIMEOUT";
        if (!trabado || intento >= MAX_REINTENTOS) throw e;
        // Espera creciente y con azar, para que dos cargas trabadas no vuelvan a chocar en el mismo instante.
        const espera = 120 * intento + Math.floor(Math.random() * 180);
        console.warn(`RG: interbloqueo en el intento ${intento}, reintentando en ${espera} ms`);
        await new Promise((r) => setTimeout(r, espera));
      }
    }

    async function escribir(cx) {
    const [[conteos]] = await cx.query(
      `SELECT
         SUM(r.id IS NULL)                                               AS nuevos,
         SUM(r.id IS NOT NULL AND r.clave_elector <> t.clave_elector)    AS reemplazados,
         SUM(r.id IS NOT NULL AND r.clave_elector = t.clave_elector)     AS existentes
       FROM temp_RG t
       LEFT JOIN RG r ON ${JOIN}
       WHERE t.carga_id = ?`,
      [cargaId]
    );

    // nuevos
    const colsInsert = [...COLUMNAS_UBICACION, ...V.COLUMNAS_PERSONA, "casa_carga", "usuario_subida"];
    await cx.query(
      `INSERT INTO RG (${colsInsert.join(", ")})
       SELECT ${[...COLUMNAS_UBICACION, ...V.COLUMNAS_PERSONA].map((c) => "t." + c).join(", ")}, ?, ?
       FROM temp_RG t
       LEFT JOIN RG r ON ${JOIN}
       WHERE t.carga_id = ? AND r.id IS NULL`,
      [usuario.casa, usuario.username, cargaId]
    );

    // Existentes: si cambio la persona se reescribe todo (vacios incluidos); si es la misma, lo en blanco no borra lo que ya estaba.
    const setsPersona = V.COLUMNAS_PERSONA.map(
      (c) =>
        `r.${c} = IF(r.clave_elector <> t.clave_elector, t.${c}, COALESCE(NULLIF(t.${c}, ''), r.${c}))`
    ).join(",\n        ");

    const [upd] = await cx.query(
      `UPDATE RG r
         JOIN temp_RG t ON ${JOIN}
       SET ${setsPersona},
           r.casa_carga = ?, r.usuario_subida = ?
       WHERE t.carga_id = ?`,
      [usuario.casa, usuario.username, cargaId]
    );

    return { conteos, upd };
    }

    resumen.nuevos = Number(conteos.nuevos) || 0;
    resumen.reemplazados = Number(conteos.reemplazados) || 0;
    // MySQL solo cuenta como "changed" las filas que realmente se modificaron
    resumen.actualizados = Math.max((upd.changedRows || 0) - resumen.reemplazados, 0);
    resumen.sinCambios = Math.max(
      (Number(conteos.existentes) || 0) - resumen.actualizados,
      0
    );

    // La carga ya está confirmada: si falla limpiar la temporal no se tira abajo, queda para la próxima.
    try {
      await conexion.query("DELETE FROM temp_RG WHERE carga_id = ?", [cargaId]);
    } catch (e) {
      console.warn(`RG: no se pudo limpiar temp_RG de ${cargaId}: ${e.message}`);
    }
    conexion.release();
    conexion = null;

    resumen.segundos = Number(((Date.now() - arranque) / 1000).toFixed(1));
    progressManager.updateProgress(
      { progress: 100, speed: "0.00", estimatedRemaining: { minutes: 0, seconds: 0 }, fase: "listo" },
      usuario.id
    );

    await pool
      .query(
        `INSERT INTO historial_carga
           (modulo, carga_id, usuario_subida, casa_carga, archivo, filas_leidas,
            nuevos, actualizados, reemplazados, sin_cambios, descartados, segundos)
         VALUES ('RG', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cargaId,
          usuario.username,
          usuario.casa,
          req.file.originalname || null,
          resumen.filasLeidas,
          resumen.nuevos,
          resumen.actualizados,
          resumen.reemplazados,
          resumen.sinCambios,
          Object.values(resumen.descartados).reduce((a, b) => a + b, 0),
          resumen.segundos,
        ]
      )
      .catch((e) => console.error("No se pudo registrar el historial", e.message));

    return res.json({ message: "Archivo procesado correctamente.", resumen });
  } catch (error) {
    if (conexion) {
      try {
        await conexion.rollback();
      } catch (_) {}
      conexion.release();
    }
    // la temporal no puede quedar con basura de esta carga
    await pool
      .query("DELETE FROM temp_RG WHERE carga_id = ?", [cargaId])
      .catch(() => {});
    return res.status(error.estado || 500).json({
      message: error.message || "Error al procesar el archivo.",
      error: error.toString(),
    });
  } finally {
    // si la carga se corto a la mitad, la barra no puede quedar clavada
    progressManager.terminar(req.user && req.user.id);
    if (req.file && req.file.path) {
      fs.promises.unlink(req.file.path).catch((e) => {
        console.error("No se pudo borrar el temporal", req.file.path, e.message);
      });
    }
  }
}

module.exports = { uploadRG, mapearFilaRG, coincideFirma, problemaDeFirma, ENCABEZADOS_RG };
