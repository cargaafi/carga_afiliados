// Carga de Responsables de Casilla (RC).
//
// Mismas reglas que RD y RG (ver validaciones.js), pero con dos diferencias:
//
//   1) Volumen: 346.792 filas (el doble de RG), asi que usa el mismo patron
//      de tabla de paso + lotes que RG.
//
//   2) La llave lleva el CARGO. Cada casilla tiene DOS responsables
//      (Propietario 1 y Propietario 2), asi que estado+seccion+tipoCasilla+
//      casilla se repite exactamente 2 veces. Verificado contra el archivo
//      real: sin el cargo da 173.396 distintas con 173.396 duplicados (cada
//      llave aparece 2 veces); con el cargo da 346.792 distintas, 0
//      duplicados. Sin el cargo, la segunda carga pisaria a la primera.
//
//   3) El orden de columnas NO es el de RG: aca el Cargo es la E, no la M.
//      El bloque de la persona (N..AC) es identico, y ademas trae una
//      columna mas, el Origen (AD), exclusiva de RC.
const fs = require("fs");
const crypto = require("crypto");
const V = require("./validaciones");
const { filasDeHoja, recorrerHoja, nombresDeHojas } = require("./lectorExcel");
const progressManager = require("./Progress");

const pool = V.pool;
const HOJA_RC = "RC";

// Encabezados esperados de la hoja RC, en su posicion exacta, tal como vienen
// en la plantilla. Se comparan LOS 30, no unos pocos: si alguien intercambia
// dos columnas que no fueran ancla los datos entrarian cruzados sin que
// nadie se entere, y eso es peor que rechazar el archivo.
const ENCABEZADOS_RC = [
  "SECCION ELECTORAL",
  "TIPO DE SECCION",
  "TIPO DE CASILLA (B,C, S,E)",
  "CASILLA",
  "CARGO",
  "ESTADO",
  "CASA",
  "CIRCUNSCRIPCION",
  "DISTRITO ELECTORAL FEDERAL",
  "CABECERA",
  "MUNICIPIO",
  "DISTRITO ELECTORAL LOCAL",
  "CABECERA",
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
  "ORIGEN (MAGISTERIO, FAMILIAR, CIUDADANO)",
];

// Letra de columna a partir del indice: 1 -> A, 14 -> N, 30 -> AD
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
  for (let i = 0; i < ENCABEZADOS_RC.length; i++) {
    const col = i + 1;
    const esperado = ENCABEZADOS_RC[i];
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

// Una fila "con responsable" tiene alguna celda de la N (14) a la AD (30).
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

// Columnas A..M de RC. Se sellan en la primera carga, igual que en RD y RG.
// Ojo: el orden NO es el de RG (aca Cargo va primero, en la posicion E).
const COLUMNAS_UBICACION = [
  "seccion_electoral_ubic",
  "tipo_seccion",
  "tipo_casilla",
  "casilla",
  "cargo",
  "estado",
  "estado_norm",
  "casa",
  "circunscripcion",
  "distrito_federal",
  "cabecera_federal",
  "municipio",
  "distrito_local",
  "cabecera_local",
];

// RC tiene una columna mas que RD/RG: Origen. Es dato de la persona (describe
// al responsable, no al lugar), asi que se agrega a COLUMNAS_PERSONA y sigue
// las mismas reglas de upsert: se reescribe si cambio la persona, no se
// borra si viene en blanco y la persona es la misma.
const COLUMNAS_PERSONA_RC = [...V.COLUMNAS_PERSONA, "origen"];

const COLUMNAS_TEMP = [
  "carga_id",
  "fila_excel",
  ...COLUMNAS_UBICACION,
  ...COLUMNAS_PERSONA_RC,
];

function mapearFilaRC(valores) {
  const c = (i) => V.txt(valores[i]);
  const estado = c(6);
  return {
    seccion_electoral_ubic: V.padNum(valores[1], 4),
    tipo_seccion: c(2) || null,
    tipo_casilla: V.norm(valores[3]) || null,
    casilla: V.norm(valores[4]) || null,
    cargo: c(5) || null,
    estado,
    estado_norm: V.entidadCanonica(estado),
    casa: c(7) || null,
    circunscripcion: V.num(valores[8]),
    distrito_federal: V.num(valores[9]),
    cabecera_federal: c(10) || null,
    municipio: c(11) || null,
    distrito_local: V.num(valores[12]),
    cabecera_local: c(13) || null,
    ...V.mapearPersona(valores), // N..AC: identico a RD y RG
    origen: c(30) || null, // AD: exclusiva de RC
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
  if (!hojas.includes(HOJA_RC)) {
    throw errorDeArchivo(
      `El archivo no tiene la hoja "RC". Tiene: ${hojas.join(", ")}. ` +
        `Sube el Excel de Responsables de Casilla.`
    );
  }
  let fila = 0;
  // del candidato que mas se acerco guardamos el problema, para poder decir
  // exactamente que columna esta mal en vez de un error generico
  let mejorProblema = null;
  await recorrerHoja(
    ruta,
    HOJA_RC,
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
      'La hoja "RC" no tiene las columnas de la plantilla' +
        (mejorProblema ? `: ${mejorProblema.texto}.` : ".") +
        " Revisa que no se hayan movido, renombrado ni agregado columnas."
    );
  }
  return fila;
}

async function uploadRC(req, res) {
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

    // Clave de elector unica en toda la tabla: una persona no puede ser
    // responsable de dos casillas a la vez, ni de Propietario 1 Y 2 de la
    // misma casilla (son 2 personas distintas). La ubicacion para este
    // chequeo lleva el cargo, igual que la UNIQUE KEY real de la tabla:
    // asi "re-subir el mismo slot" sigue permitido, pero "el mismo slot con
    // otro cargo" se rechaza. Se precarga que clave esta en que lugar (de la
    // base y de lo que se va aceptando de este mismo archivo).
    const [clavesExistentesRC] = await pool.query(
      "SELECT clave_elector, estado_norm, seccion_electoral_ubic, tipo_casilla, casilla, cargo FROM RC"
    );
    const claveAUbicacion = new Map();
    for (const c of clavesExistentesRC) {
      claveAUbicacion.set(c.clave_elector, {
        key: `${c.estado_norm}|${c.seccion_electoral_ubic}|${c.tipo_casilla}|${c.casilla}|${c.cargo}`,
        texto: `la sección ${c.seccion_electoral_ubic}, casilla ${c.casilla}, ${c.cargo} (${c.estado_norm})`,
      });
    }

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
        claveRepetida: 0,
      },
      avisos: { sexo: 0, correo: 0 },
      entidadUsuario: usuario.nacional ? "Todas" : usuario.entidad,
      detalle: [],
      avisosDetalle: [],
      cambios: [],
      segundos: 0,
    };
    // Los errores a corregir se listan casi todos. Las filas de otras casas
    // van con tope chico: con el archivo completo son 340 mil y no son un
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
          // se incluye el cargo: una casilla tiene 2 filas (Propietario 1 y 2)
          distrito: `sección ${d.seccion_electoral_ubic} · casilla ${d.casilla} · ${d.cargo || ""}`.trim(),
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
        `INSERT INTO temp_RC (${COLUMNAS_TEMP.join(", ")}) VALUES ?`,
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

    for await (const f of filasDeHoja(req.file.path, HOJA_RC, {
      maxColumna: 40,
      desdeFila: filaEncabezado + 1,
      // de acá sale la velocidad: una fila sin nada de la N en adelante ni
      // siquiera se parsea
      filtroRapido: (xml) => TIENE_PERSONA.test(xml),
    })) {
      resumen.filasLeidas++;
      const nro = f.nro;
      const d = mapearFilaRC(f.valores);

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
          `sección ${d.seccion_electoral_ubic} · casilla ${d.casilla} · ${d.cargo || "sin cargo"} — corresponde ` +
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

      // clave de elector repetida: esa persona ya es responsable de OTRA
      // casilla (en la base, o en una fila anterior de este mismo archivo).
      // No se mueve de lugar sola: se rechaza y se corrige a mano.
      const miUbicacionRC = `${d.estado_norm}|${d.seccion_electoral_ubic}|${d.tipo_casilla}|${d.casilla}|${d.cargo}`;
      const ubicacionPreviaRC = claveAUbicacion.get(d.clave_elector);
      if (ubicacionPreviaRC && ubicacionPreviaRC.key !== miUbicacionRC) {
        resumen.descartados.claveRepetida++;
        agregarDetalle(
          nro,
          `la clave ${d.clave_elector} ya está asignada a ${ubicacionPreviaRC.texto}`
        );
        continue;
      }
      claveAUbicacion.set(d.clave_elector, {
        key: miUbicacionRC,
        texto: `la sección ${d.seccion_electoral_ubic}, casilla ${d.casilla}, ${d.cargo} (${d.estado_norm})`,
      });

      // vigencia de INE, telefono, codigo postal y origen son obligatorios en
      // RC: si falta alguno, o el telefono no son 10 digitos numericos, la
      // fila no se sube. Origen es exclusivo de RC, por eso se suma aca.
      const motivosDatos = V.motivosDescarteDatos(d);
      if (!d.origen) motivosDatos.push({ tipo: "origen", texto: "sin origen" });
      if (motivosDatos.length) {
        resumen.descartados.datosIncompletos++;
        agregarDetalle(nro, motivosDatos.map((m) => m.texto).join(" · "));
        continue;
      }

      // misma casilla Y mismo cargo dos veces en el mismo archivo: gana la
      // ultima y se avisa. Propietario 1 y Propietario 2 NO son duplicados
      // entre si: el cargo forma parte de la llave.
      const llave = `${d.estado_norm}|${d.seccion_electoral_ubic}|${d.tipo_casilla}|${d.casilla}|${d.cargo}`;
      if (vistas.has(llave)) {
        resumen.descartados.repetidaEnArchivo++;
        agregarDetalle(
          nro,
          `${d.cargo || "el responsable"} de la casilla ${d.casilla}, sección ${d.seccion_electoral_ubic} viene repetido en el archivo — se toma el último`
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
        ...COLUMNAS_PERSONA_RC.map((c) => d[c] ?? null),
      ]);

      // Los lotes se escriben EN ORDEN (await adentro del for await): si un
      // responsable viene repetido, el ultimo del archivo es el que queda.
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
      AND r.casilla = t.casilla
      AND r.cargo = t.cargo`;

    // Si el responsable vino repetido en el archivo, gana el ultimo. Se
    // compara por numero de fila del Excel y se resuelve ANTES de tocar RC,
    // con una sola sentencia (ver el comentario largo en RGController.js
    // sobre por que esto NO puede ser una subconsulta correlacionada: con
    // varias cargas a la vez bloqueaba decenas de miles de filas).
    if (resumen.descartados.repetidaEnArchivo > 0) {
      await pool.query(
        `DELETE vieja FROM temp_RC vieja
           JOIN temp_RC nueva
             ON nueva.carga_id = vieja.carga_id
            AND nueva.estado_norm = vieja.estado_norm
            AND nueva.seccion_electoral_ubic = vieja.seccion_electoral_ubic
            AND nueva.tipo_casilla = vieja.tipo_casilla
            AND nueva.casilla = vieja.casilla
            AND nueva.cargo = vieja.cargo
            AND nueva.fila_excel > vieja.fila_excel
         WHERE vieja.carga_id = ?`,
        [cargaId]
      );
    }

    // Red de seguridad contra una carrera entre 2 cargas simultaneas: el
    // chequeo de "clave repetida" de la lectura corre contra una FOTO de la
    // base tomada al empezar a leer el archivo. Si OTRA carga, al mismo
    // tiempo, confirmo esa misma clave en otro lugar mientras esta leia, el
    // INSERT de abajo chocaria contra el UNIQUE KEY y tiraria abajo TODO el
    // archivo. Por eso se re-chequea contra el estado actual justo antes de
    // escribir, y se descarta solo esa fila (rarisimo, pero el archivo
    // entero no puede depender de que nunca pase).
    const [choquesClaveRC] = await pool.query(
      `SELECT t.fila_excel, r.seccion_electoral_ubic AS seccion_ya, r.casilla AS casilla_ya,
              r.cargo AS cargo_ya, r.estado_norm AS estado_ya
       FROM temp_RC t
       JOIN RC r ON r.clave_elector = t.clave_elector
       WHERE t.carga_id = ? AND NOT (
         r.estado_norm = t.estado_norm AND r.seccion_electoral_ubic = t.seccion_electoral_ubic
         AND r.tipo_casilla = t.tipo_casilla AND r.casilla = t.casilla AND r.cargo = t.cargo
       )`,
      [cargaId]
    );
    if (choquesClaveRC.length) {
      for (const c of choquesClaveRC) {
        resumen.descartados.claveRepetida++;
        agregarDetalle(
          c.fila_excel,
          `la clave ya está asignada a la sección ${c.seccion_ya}, casilla ${c.casilla_ya}, ${c.cargo_ya} (${c.estado_ya})`
        );
      }
      await pool.query(
        `DELETE t FROM temp_RC t
         JOIN RC r ON r.clave_elector = t.clave_elector
         WHERE t.carga_id = ? AND NOT (
           r.estado_norm = t.estado_norm AND r.seccion_electoral_ubic = t.seccion_electoral_ubic
           AND r.tipo_casilla = t.tipo_casilla AND r.casilla = t.casilla AND r.cargo = t.cargo
         )`,
        [cargaId]
      );
    }

    // Mismo patron que RG: reintentos ante interbloqueo + READ COMMITTED.
    // Medido en RG: sin esto, 10 cargas simultaneas se trababan entre si.
    let conteos, upd;
    for (let intento = 1; ; intento++) {
      try {
        conexion = await pool.getConnection();
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
        const espera = 120 * intento + Math.floor(Math.random() * 180);
        console.warn(`RC: interbloqueo en el intento ${intento}, reintentando en ${espera} ms`);
        await new Promise((r) => setTimeout(r, espera));
      }
    }

    async function escribir(cx) {
    const [[conteos]] = await cx.query(
      `SELECT
         SUM(r.id IS NULL)                                               AS nuevos,
         SUM(r.id IS NOT NULL AND r.clave_elector <> t.clave_elector)    AS reemplazados,
         SUM(r.id IS NOT NULL AND r.clave_elector = t.clave_elector)     AS existentes
       FROM temp_RC t
       LEFT JOIN RC r ON ${JOIN}
       WHERE t.carga_id = ?`,
      [cargaId]
    );

    // nuevos
    const colsInsert = [...COLUMNAS_UBICACION, ...COLUMNAS_PERSONA_RC, "casa_carga", "usuario_subida"];
    await cx.query(
      `INSERT INTO RC (${colsInsert.join(", ")})
       SELECT ${[...COLUMNAS_UBICACION, ...COLUMNAS_PERSONA_RC].map((c) => "t." + c).join(", ")}, ?, ?
       FROM temp_RC t
       LEFT JOIN RC r ON ${JOIN}
       WHERE t.carga_id = ? AND r.id IS NULL`,
      [usuario.casa, usuario.username, cargaId]
    );

    // existentes: si cambio la persona se reescribe todo (vacios incluidos);
    // si es la misma, lo que viene en blanco NO borra lo que ya estaba.
    const setsPersona = COLUMNAS_PERSONA_RC.map(
      (c) =>
        `r.${c} = IF(r.clave_elector <> t.clave_elector, t.${c}, COALESCE(NULLIF(t.${c}, ''), r.${c}))`
    ).join(",\n        ");

    const [upd] = await cx.query(
      `UPDATE RC r
         JOIN temp_RC t ON ${JOIN}
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

    // La carga ya está confirmada en RC: si limpiar la temporal falla por
    // contención, no se puede tirar abajo una carga que salió bien.
    try {
      await conexion.query("DELETE FROM temp_RC WHERE carga_id = ?", [cargaId]);
    } catch (e) {
      console.warn(`RC: no se pudo limpiar temp_RC de ${cargaId}: ${e.message}`);
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
         VALUES ('RC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      .query("DELETE FROM temp_RC WHERE carga_id = ?", [cargaId])
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

module.exports = { uploadRC, mapearFilaRC, coincideFirma, problemaDeFirma, ENCABEZADOS_RC };
