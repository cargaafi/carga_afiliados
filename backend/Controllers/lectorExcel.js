// Lector de .xlsx pensado para las hojas grandes (RG 173k filas / 147 MB,
// RC 347k / 312 MB).
//
// exceljs arma un objeto Cell por celda: son ~2 millones de objetos solo para
// RG y tarda ~18 s. Nosotros necesitamos 29 strings por fila, asi que leemos
// el XML del zip de corrido. Medido: 1,1 s para RG y 2,3 s para RC, y saltando
// las filas sin responsable baja a 0,8 s y 1,6 s.
//
// Verificado celda por celda contra exceljs: 0 diferencias en 90.000 celdas.
// La prueba vive en backend/pruebas/lector.test.js y hay que correrla si se
// toca este archivo.
//
// unzipper no es una dependencia nueva: ya venia instalada porque la usa
// exceljs.
const unzipper = require("unzipper");
const { StringDecoder } = require("string_decoder");

// Dos formas posibles de celda: <c .../> vacia, o <c ...>contenido</c>.
// Hay que distinguirlas con una alternancia; con un grupo opcional y perezoso
// el motor prefiere no capturar nada y se pierden valores.
const CELDA = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/g;
const VALOR = /<v>([^<]*)<\/v>/;
const TEXTO = /<t[^>]*>([^<]*)<\/t>/g;
const NRO_FILA = /<row r="(\d+)"/;

function colIndice(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n;
}

// El XML escapa &, <, > y comillas: hay que devolverlos o un apellido como
// "PEÑA & ASOCIADOS" llega partido.
function desescapar(s) {
  if (s.indexOf("&") === -1) return s;
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

async function abrir(ruta) {
  return unzipper.Open.file(ruta);
}

async function leerSharedStrings(zip) {
  const f = zip.files.find((x) => x.path === "xl/sharedStrings.xml");
  if (!f) return [];
  const xml = String(await f.buffer());
  const out = [];
  for (const m of xml.matchAll(/<si>(.*?)<\/si>/gs)) {
    // un <si> puede traer varios <t> si la celda tiene formato mezclado
    let s = "";
    TEXTO.lastIndex = 0;
    for (const t of m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)) s += t[1];
    out.push(desescapar(s));
  }
  return out;
}

// Nombre de hoja -> archivo XML dentro del zip.
async function mapaDeHojas(zip) {
  const wb = zip.files.find((x) => x.path === "xl/workbook.xml");
  const rels = zip.files.find((x) => x.path === "xl/_rels/workbook.xml.rels");
  if (!wb || !rels) return new Map();
  const xmlWb = String(await wb.buffer());
  const xmlRels = String(await rels.buffer());

  const destino = new Map(); // rId -> xl/worksheets/sheetN.xml
  for (const m of xmlRels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    let t = m[2].replace(/^\/?xl\//, "").replace(/^\.\//, "");
    destino.set(m[1], "xl/" + t);
  }

  const hojas = new Map(); // nombre -> ruta
  for (const m of xmlWb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const ruta = destino.get(m[2]);
    if (ruta) hojas.set(desescapar(m[1]), ruta);
  }
  return hojas;
}

/**
 * Iterador asincrono de filas: `for await (const f of filasDeHoja(...))`.
 * Se usa este y no un callback porque el que consume necesita hacer awaits
 * (escribir un lote en la base) y que la lectura lo espere.
 *
 * Cada elemento es { valores, nro, totalFilas, bytesLeidos, totalBytes }.
 * `valores` esta indexado por columna (1 = A), igual que exceljs.
 *
 * filtroRapido recibe el XML crudo de la fila y devuelve false para
 * descartarla sin parsear ni una celda: de ahi sale casi toda la velocidad.
 */
async function* filasDeHoja(ruta, nombreHoja, opciones = {}) {
  const { filtroRapido = null, maxColumna = 40, desdeFila = 1 } = opciones;
  const zip = await abrir(ruta);
  const hojas = await mapaDeHojas(zip);
  const rutaHoja = hojas.get(nombreHoja);
  if (!rutaHoja) throw new Error(`El archivo no tiene la hoja "${nombreHoja}"`);

  const shared = await leerSharedStrings(zip);
  const entrada = zip.files.find((x) => x.path === rutaHoja);
  const totalBytes = entrada.uncompressedSize || 0;

  let resto = "";
  let bytesLeidos = 0;
  let totalFilas = 0;
  const dec = new StringDecoder("utf8");

  for await (const chunk of entrada.stream()) {
    bytesLeidos += chunk.length;
    resto += dec.write(chunk);

    // la hoja declara su rango al principio: <dimension ref="A1:AC173399"/>
    if (!totalFilas) {
      const dim = /<dimension ref="[A-Z]+\d+:[A-Z]+(\d+)"/.exec(resto);
      if (dim) totalFilas = Number(dim[1]);
    }

    let corte;
    while ((corte = resto.indexOf("</row>")) !== -1) {
      const trozo = resto.slice(0, corte);
      resto = resto.slice(corte + 6);
      const ini = trozo.lastIndexOf("<row ");
      if (ini === -1) continue;
      const cuerpo = trozo.slice(ini);

      const nro = Number((NRO_FILA.exec(cuerpo) || [])[1] || 0);
      if (nro < desdeFila) continue;
      if (filtroRapido && !filtroRapido(cuerpo)) continue;

      yield {
        valores: parsearFila(cuerpo, shared, maxColumna),
        nro,
        totalFilas,
        bytesLeidos,
        totalBytes,
      };
    }
  }
}

function parsearFila(cuerpo, shared, maxColumna) {
  const valores = [];
  CELDA.lastIndex = 0;
  let m;
  while ((m = CELDA.exec(cuerpo)) !== null) {
    if (m[3] === undefined) continue; // celda vacia autocerrada
    const col = colIndice(m[1]);
    if (col > maxColumna) continue;
    const attrs = m[2] || "";
    const inner = m[3];
    let v = "";
    if (attrs.includes('t="s"')) {
      const r = VALOR.exec(inner);
      v = r ? shared[Number(r[1])] || "" : "";
    } else if (attrs.includes('t="inlineStr"')) {
      let s2 = "";
      for (const t of inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)) s2 += t[1];
      v = desescapar(s2);
    } else {
      const r = VALOR.exec(inner);
      v = r ? desescapar(r[1]) : "";
    }
    valores[col] = v;
  }
  return valores;
}

/**
 * Version con callback, para los casos simples (leer encabezados, pruebas).
 * Devolver false desde onFila corta la lectura.
 */
async function recorrerHoja(ruta, nombreHoja, onFila, opciones = {}) {
  let filas = 0;
  let procesadas = 0;
  for await (const f of filasDeHoja(ruta, nombreHoja, opciones)) {
    filas = f.nro;
    procesadas++;
    if (onFila(f.valores, f.nro) === false) break;
  }
  return { encontrada: true, filas, procesadas };
}

// Devuelve solo los encabezados de una hoja, para validar la firma de columnas
// sin leer el archivo entero.
async function leerEncabezados(ruta, nombreHoja, hastaFila = 8) {
  const encontrados = [];
  await recorrerHoja(
    ruta,
    nombreHoja,
    (valores, nro) => {
      if (nro > hastaFila) return false; // corta: no recorre la hoja entera
      encontrados.push({ nro, valores });
    },
    { maxColumna: 40 }
  );
  return encontrados;
}

async function nombresDeHojas(ruta) {
  const zip = await abrir(ruta);
  return [...(await mapaDeHojas(zip)).keys()];
}

module.exports = { filasDeHoja, recorrerHoja, leerEncabezados, nombresDeHojas, colIndice, desescapar };
