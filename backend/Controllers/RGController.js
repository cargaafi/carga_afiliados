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
    const agregarDetalle = (fila, motivo) => {
      if (resumen.detalle.length < 50) resumen.detalle.push({ fila, motivo });
    };
    const agregarAviso = (fila, d, texto) => {
      if (resumen.avisosDetalle.length < 50)
        resumen.avisosDetalle.push({
          fila,
          distrito: `sección ${d.seccion_electoral_ubic} · casilla ${d.casilla}`,
          texto,
        });
    };

    // ---------------------------------------------------------------
    // 1) leer + filtrar en memoria, e ir mandando lotes a la temporal
    // ---------------------------------------------------------------
    progressManager.updateProgress({ progress: 0, speed: 0, estimatedRemaining: { minutes: 0, seconds: 0 } });

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
            `${V.frasePertenencia(mapaCasas, d.estado_norm)}, no a la casa ${usuario.casa}`
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
          const transcurrido = (Date.now() - arranque) / 1000;
          const porSegundo = escritas / Math.max(transcurrido, 0.1);
          const restantes = Math.max((f.totalFilas || 0) - f.nro, 0);
          const avance = f.totalBytes
            ? Math.round((f.bytesLeidos / f.totalBytes) * 95)
            : 0;
          progressManager.updateProgress({
            progress: Math.min(avance, 95),
            speed: porSegundo.toFixed(2),
            estimatedRemaining: {
              minutes: Math.floor(restantes / Math.max(porSegundo, 1) / 60),
              seconds: Math.round((restantes / Math.max(porSegundo, 1)) % 60),
            },
          });
        }
      }
    }

    await vaciarLote();

    // ---------------------------------------------------------------
    // 2) contar y escribir
    // ---------------------------------------------------------------
    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    const JOIN = `
      r.estado_norm = t.estado_norm
      AND r.seccion_electoral_ubic = t.seccion_electoral_ubic
      AND r.tipo_casilla = t.tipo_casilla
      AND r.casilla = t.casilla`;

    // Si la casilla vino repetida en el archivo, gana la ultima. Se compara por
    // numero de fila del Excel y no por id de la temporal: asi el resultado no
    // depende del orden en que se escribieron los lotes.
    const ULTIMA = `
      t.fila_excel = (SELECT MAX(t2.fila_excel) FROM temp_RG t2
                      WHERE t2.carga_id = t.carga_id
                        AND t2.estado_norm = t.estado_norm
                        AND t2.seccion_electoral_ubic = t.seccion_electoral_ubic
                        AND t2.tipo_casilla = t.tipo_casilla
                        AND t2.casilla = t.casilla)`;

    const [[conteos]] = await conexion.query(
      `SELECT
         SUM(r.id IS NULL)                                               AS nuevos,
         SUM(r.id IS NOT NULL AND r.clave_elector <> t.clave_elector)    AS reemplazados,
         SUM(r.id IS NOT NULL AND r.clave_elector = t.clave_elector)     AS existentes
       FROM temp_RG t
       LEFT JOIN RG r ON ${JOIN}
       WHERE t.carga_id = ? AND ${ULTIMA}`,
      [cargaId]
    );

    // nuevos
    const colsInsert = [...COLUMNAS_UBICACION, ...V.COLUMNAS_PERSONA, "casa_carga", "usuario_subida"];
    await conexion.query(
      `INSERT INTO RG (${colsInsert.join(", ")})
       SELECT ${[...COLUMNAS_UBICACION, ...V.COLUMNAS_PERSONA].map((c) => "t." + c).join(", ")}, ?, ?
       FROM temp_RG t
       LEFT JOIN RG r ON ${JOIN}
       WHERE t.carga_id = ? AND r.id IS NULL AND ${ULTIMA}`,
      [usuario.casa, usuario.username, cargaId]
    );

    // existentes: si cambio la persona se reescribe todo (vacios incluidos);
    // si es la misma, lo que viene en blanco NO borra lo que ya estaba.
    const setsPersona = V.COLUMNAS_PERSONA.map(
      (c) =>
        `r.${c} = IF(r.clave_elector <> t.clave_elector, t.${c}, COALESCE(NULLIF(t.${c}, ''), r.${c}))`
    ).join(",\n        ");

    const [upd] = await conexion.query(
      `UPDATE RG r
         JOIN temp_RG t ON ${JOIN}
       SET ${setsPersona},
           r.casa_carga = ?, r.usuario_subida = ?
       WHERE t.carga_id = ? AND ${ULTIMA}`,
      [usuario.casa, usuario.username, cargaId]
    );

    await conexion.commit();

    resumen.nuevos = Number(conteos.nuevos) || 0;
    resumen.reemplazados = Number(conteos.reemplazados) || 0;
    // MySQL solo cuenta como "changed" las filas que realmente se modificaron
    resumen.actualizados = Math.max((upd.changedRows || 0) - resumen.reemplazados, 0);
    resumen.sinCambios = Math.max(
      (Number(conteos.existentes) || 0) - resumen.actualizados,
      0
    );

    await conexion.query("DELETE FROM temp_RG WHERE carga_id = ?", [cargaId]);
    conexion.release();
    conexion = null;

    resumen.segundos = Number(((Date.now() - arranque) / 1000).toFixed(1));
    progressManager.updateProgress({ progress: 100, speed: 0, estimatedRemaining: { minutes: 0, seconds: 0 } });

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
    if (req.file && req.file.path) {
      fs.promises.unlink(req.file.path).catch((e) => {
        console.error("No se pudo borrar el temporal", req.file.path, e.message);
      });
    }
  }
}

module.exports = { uploadRG, mapearFilaRG, coincideFirma, problemaDeFirma, ENCABEZADOS_RG };
