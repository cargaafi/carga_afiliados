// Carga de Responsables Generales (RG).
//
// Mismas reglas que RD (ver validaciones.js), pero con otro volumen: la
// plantilla trae 173.396 filas en vez de 300. Por eso cambia la mecanica:
//
//   RD  -> un SELECT por fila. Con 300 filas son 300 viajes a la base: va bien.
//   RG  -> eso serian 173 mil viajes. Aca va a tabla de paso + 2 sentencias.
//
// El filtro por casa corre ANTES de tocar la base: si la casa 14 sube el
// archivo completo, de las 173k solo se escriben las ~5 mil de su entidad.
const fs = require("fs");
const crypto = require("crypto");
const V = require("./validaciones");
const { filasDeHoja, recorrerHoja, nombresDeHojas } = require("./lectorExcel");
const progressManager = require("./Progress");

const pool = V.pool;
const HOJA_RG = "RG";

// Encabezados esperados de la hoja RG, en su posicion exacta, tal como vienen
// en la plantilla. Se comparan LOS 29, no unos pocos: si alguien intercambia
// dos columnas que no fueran ancla (por ejemplo Cabecera y Municipio) los
// datos entrarian cruzados sin que nadie se entere, y eso es peor que
// rechazar el archivo.
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

// Devuelve null si la fila es el encabezado correcto, o el texto del primer
// problema encontrado.
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

// Una fila "con responsable" tiene alguna celda de la N (14) en adelante.
// La plantilla las trae creadas pero vacias y autocerradas (<c r="N4" s="6"/>),
// por eso se exige que la etiqueta NO termine en "/>".
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

// Devuelve en que fila esta el encabezado, para empezar a leer datos recien
// despues. Importante: la fila de encabezados dice "Apellido Paterno" en la N,
// asi que pasa el filtro rapido y hay que saltearla por numero de fila.
async function filaDeEncabezado(ruta) {
  const hojas = await nombresDeHojas(ruta);
  if (!hojas.includes(HOJA_RG)) {
    throw errorDeArchivo(
      `El archivo no tiene la hoja "RG". Tiene: ${hojas.join(", ")}. ` +
        `Sube el Excel de Responsables Generales.`
    );
  }
  let fila = 0;
  // del candidato que mas se acerco guardamos el problema, para poder decir
  // exactamente que columna esta mal en vez de un error generico
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
      descartados: { claveInvalida: 0, sinCasilla: 0, otroEstado: 0, repetidaEnArchivo: 0 },
      avisos: { vigencia: 0, vigenciaVencida: 0, sexo: 0, telefono: 0, correo: 0 },
      entidadUsuario: usuario.nacional ? "Todas" : usuario.entidad,
      detalle: [],
      avisosDetalle: [],
      cambios: [],
      segundos: 0,
    };
    // Los errores a corregir se listan casi todos. Las filas de otras casas
    // van con tope chico: con el archivo completo son 168 mil y no son un
    // error, pasa siempre que alguien sube la plantilla entera. El contador
    // las cuenta igual.
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

    // ---------------------------------------------------------------
    // 1) leer + filtrar en memoria, e ir mandando lotes a la temporal
    // ---------------------------------------------------------------
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

    // Cronometro propio para la velocidad: "arranque" incluye resolver el
    // usuario, validar encabezados y consultar las casas (viajes a la base
    // antes de leer una sola fila). Si se usa ese tiempo para medir bytes/s,
    // la primera lectura infla el "tiempo transcurrido" con trabajo que no
    // es lectura, y la ETA sale mucho mas alta de lo real.
    const inicioLectura = Date.now();

    for await (const f of filasDeHoja(req.file.path, HOJA_RG, {
      maxColumna: 40,
      desdeFila: filaEncabezado + 1,
      // de acá sale la velocidad: una fila sin nada de la N en adelante ni
      // siquiera se parsea
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

      // Los lotes se escriben EN ORDEN (await adentro del for await): si una
      // casilla viene repetida, la ultima del archivo es la que queda.
      if (lote.length >= TAMANO_LOTE) {
        await vaciarLote();
        if (Date.now() - ultimoAviso > 400) {
          ultimoAviso = Date.now();
          const transcurrido = (Date.now() - inicioLectura) / 1000;
          const porSegundo = escritas / Math.max(transcurrido, 0.1);
          const avance = f.totalBytes
            ? Math.round((f.bytesLeidos / f.totalBytes) * 95)
            : 0;
          // El tiempo que falta se calcula con BYTES, no con filas: "escritas"
          // son solo las filas de tu casa (una fraccion chica del archivo si
          // tu entidad es pequeña), y comparar eso contra "filas que faltan
          // LEER del archivo entero" mezclaba dos velocidades distintas -
          // daba ETAs de varios minutos en cargas que terminaban en segundos.
          // Con bytes, el % y la ETA miden lo mismo: cuanto queda por leer.
          //
          // Ademas: el PRIMER aviso sale contaminado por costos fijos que no
          // son lectura (abrir la conexion a la base para el primer lote,
          // arranque del motor). Medido: en una carga real, los primeros
          // 0.46s leyeron a 2.4 MB/s pero el resto del archivo iba a 26.6
          // MB/s - 11 veces mas rapido. Proyectar con esa primera muestra da
          // una ETA absurda. Por eso no se manda ETA hasta pasado 1s desde
          // que arranco la lectura: antes de eso, el frontend ya sabe mostrar
          // solo el % y la velocidad, sin inventar un "faltan X" que no vale.
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

    // Ya se terminó de leer el archivo, pero falta escribir en la tabla
    // definitiva (contar, insertar, actualizar) - con archivos chicos esto
    // puede tardar mas que la lectura, y antes no tenia ningun aviso: la
    // barra se quedaba muda hasta que saltaba directo al cartel final.
    progressManager.updateProgress(
      { progress: 96, speed: "0.00", estimatedRemaining: { minutes: 0, seconds: 0 }, fase: "guardando" },
      usuario.id
    );

    // ---------------------------------------------------------------
    // 2) contar y escribir
    // ---------------------------------------------------------------
    const JOIN = `
      r.estado_norm = t.estado_norm
      AND r.seccion_electoral_ubic = t.seccion_electoral_ubic
      AND r.tipo_casilla = t.tipo_casilla
      AND r.casilla = t.casilla`;

    // Si la casilla vino repetida en el archivo, gana la ultima. Antes esto
    // era una subconsulta correlacionada dentro del INSERT y del UPDATE: se
    // evaluaba UNA VEZ POR FILA sobre una temp_RG que, con varias cargas a la
    // vez, tiene decenas de miles de filas. Medido: un INSERT de 5.000 filas
    // llegaba a bloquear 28.000, y con 10 cargas simultaneas la base cortaba
    // por "lock wait timeout".
    //
    // Ahora se resuelve ANTES, con una sola sentencia que borra las repetidas
    // y deja la ultima. Y solo se ejecuta si de verdad hubo repetidas, cosa
    // que ya sabemos de la lectura.
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

    // Escribir en RG desde varias cargas a la vez provoca interbloqueos: el
    // INSERT...SELECT y el UPDATE toman candados sobre el indice unico y dos
    // transacciones concurrentes se traban. InnoDB corta una y pide
    // reintentarla ("try restarting transaction"), asi que eso hacemos. Medido:
    // con 5 cargas simultaneas fallaban 2 de 5 sin esto.
    let conteos, upd;
    for (let intento = 1; ; intento++) {
      try {
        conexion = await pool.getConnection();
        // READ COMMITTED en vez del REPEATABLE READ por defecto: con el nivel
        // por defecto, el INSERT...SELECT toma candados de RANGO sobre los
        // indices y termina bloqueando filas de OTRAS cargas, aunque cada una
        // trabaje sobre su propio carga_id. Medido: con 10 cargas a la vez
        // daba "Lock wait timeout exceeded". Acá no hace falta repeatable
        // read: cada carga solo lee lo suyo.
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
        // espera creciente y con un poco de azar, para que dos cargas trabadas
        // entre si no vuelvan a chocar en el mismo instante
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

    // existentes: si cambio la persona se reescribe todo (vacios incluidos);
    // si es la misma, lo que viene en blanco NO borra lo que ya estaba.
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

    // La carga ya está confirmada en RG: si limpiar la temporal falla por
    // contención, no se puede tirar abajo una carga que salió bien. Quedan
    // unas filas sueltas, que la próxima carga de ese usuario borra igual.
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
