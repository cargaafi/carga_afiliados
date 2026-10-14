// Prueba de regresion del lector rapido: tiene que devolver EXACTAMENTE lo
// mismo que exceljs, celda por celda. Si se toca lectorExcel.js hay que
// correr esto:
//
//   node backend/pruebas/lector.test.js "ruta/al/archivo.xlsx" "RG"
//
// El archivo real no esta en git (pesa 53 MB), por eso se pasa por parametro.
const path = require("path");
const ExcelJS = require("exceljs");
const { recorrerHoja, nombresDeHojas } = require("../Controllers/lectorExcel");

const LIMITE = Number(process.env.LIMITE || 3000);

// mismo criterio de texto que usa validaciones.txt(), para comparar peras con peras
function txtExcel(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return "";
  }
  return String(v).trim();
}

async function conExceljs(ruta, hoja) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(ruta, {
    entries: "emit",
    sharedStrings: "cache",
    worksheets: "emit",
  });
  const filas = [];
  for await (const ws of reader) {
    if (ws.name !== hoja) {
      for await (const _ of ws) {} // hay que drenarla igual
      continue;
    }
    for await (const row of ws) {
      filas.push((row.values || []).map(txtExcel));
      if (filas.length >= LIMITE) break;
    }
    break;
  }
  return filas;
}

async function conLectorRapido(ruta, hoja) {
  const filas = [];
  await recorrerHoja(
    ruta,
    hoja,
    (valores) => {
      filas.push(valores);
      if (filas.length >= LIMITE) return false;
    },
    { maxColumna: 40 }
  );
  return filas;
}

(async () => {
  const ruta = process.argv[2];
  const hoja = process.argv[3] || "RG";
  if (!ruta) {
    console.error('Uso: node backend/pruebas/lector.test.js "archivo.xlsx" "RG"');
    process.exit(2);
  }

  console.log("archivo: " + path.basename(ruta));
  console.log("hojas:   " + (await nombresDeHojas(ruta)).join(" | "));
  console.log("hoja a comparar: " + hoja + "   (hasta " + LIMITE + " filas)\n");

  const t1 = Date.now();
  const rapido = await conLectorRapido(ruta, hoja);
  const tRapido = Date.now() - t1;

  const t2 = Date.now();
  const oficial = await conExceljs(ruta, hoja);
  const tExcel = Date.now() - t2;

  let comparadas = 0;
  let diffs = 0;
  const ejemplos = [];
  const n = Math.min(rapido.length, oficial.length);
  for (let f = 0; f < n; f++) {
    for (let c = 1; c <= 40; c++) {
      const a = rapido[f] && rapido[f][c] !== undefined ? String(rapido[f][c]).trim() : "";
      const b = oficial[f] && oficial[f][c] !== undefined ? String(oficial[f][c]).trim() : "";
      comparadas++;
      if (a !== b) {
        diffs++;
        if (ejemplos.length < 10)
          ejemplos.push(`  fila ${f + 1} col ${c}: rapido="${a}"  exceljs="${b}"`);
      }
    }
  }

  console.log("filas:  rapido=" + rapido.length + "  exceljs=" + oficial.length);
  console.log("tiempo: rapido=" + tRapido + " ms   exceljs=" + tExcel + " ms");
  console.log("celdas comparadas: " + comparadas);

  const filasIguales = rapido.length === oficial.length;
  if (diffs === 0 && filasIguales) {
    console.log("\nOK - identico a exceljs");
    process.exit(0);
  }
  console.log("\nFALLA - " + diffs + " diferencias" + (filasIguales ? "" : " + distinta cantidad de filas"));
  console.log(ejemplos.join("\n"));
  process.exit(1);
})();
