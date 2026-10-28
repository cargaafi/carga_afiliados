// El HTML del popup de resumen. Lo usan RD y RG, asi que el formato es uno solo.
//
// La idea del armado: los numeros se agrupan en "se cargaron" y "no se
// cargaron", cada grupo con su total y alineados a la derecha. Asi se puede
// verificar la suma de un vistazo, que es lo que antes no se podia: habia
// items sueltos y dos categorias distintas de "no entro" sin forma de saber
// cuales sumaban entre si.

const SLATE = '#455A64';
const n = (x) => Number(x || 0).toLocaleString('es-MX');

function fila(icono, color, texto, valor, sangria = true) {
  return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13.5px;${
    sangria ? 'padding-left:10px;' : ''
  }">
    <span style="width:20px;text-align:center;flex-shrink:0;">${icono}</span>
    <span style="color:${color};text-align:left;flex:1;">${texto}</span>
    <span style="color:${color};font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;">${n(valor)}</span>
  </div>`;
}

function encabezadoGrupo(texto, total, color) {
  return `<div style="display:flex;align-items:baseline;gap:8px;margin-top:14px;
      padding-bottom:5px;border-bottom:1px solid #e0e0e0;">
    <span style="flex:1;font-size:12px;font-weight:700;letter-spacing:.4px;
      text-transform:uppercase;color:${color};">${texto}</span>
    <span style="font-size:15px;font-weight:700;color:${color};
      font-variant-numeric:tabular-nums;">${n(total)}</span>
  </div>`;
}

function bloqueDetalle(titulo, lista, total, render) {
  if (!lista || !lista.length) return '';
  const recortado = total && total > lista.length;
  const etiqueta = recortado
    ? `${titulo} (los primeros ${n(lista.length)} de ${n(total)})`
    : `${titulo} (${n(lista.length)})`;
  return `<details style="margin-top:10px;border-top:1px solid #e0e0e0;padding-top:8px;">
    <summary style="cursor:pointer;font-size:13px;color:${SLATE};">${etiqueta}</summary>
    <ul style="margin:8px 0 0;padding-left:20px;font-size:12px;color:#546E7A;max-height:190px;overflow-y:auto;">
      ${lista.map(render).join('')}
    </ul>
  </details>`;
}

export function armarResumenHtml(r) {
  const d = r.descartados || {};
  const a = r.avisos || {};

  // --- se cargaron ---
  const cargados = (r.nuevos || 0) + (r.actualizados || 0) + (r.reemplazados || 0) + (r.sinCambios || 0);
  let html = '';
  if (cargados) {
    html += encabezadoGrupo('Se cargaron', cargados, '#2e7d32');
    if (r.nuevos) html += fila('✅', '#2e7d32', 'nuevos', r.nuevos);
    if (r.actualizados) html += fila('🔄', SLATE, 'actualizados', r.actualizados);
    if (r.reemplazados) html += fila('👤', SLATE, 'con responsable reemplazado', r.reemplazados);
    if (r.sinCambios) html += fila('⏸️', '#78909C', 'sin cambios', r.sinCambios);
  }

  // --- no se cargaron ---
  const errores = (d.claveInvalida || 0) + (d.sinDistrito || 0) + (d.sinCasilla || 0) +
    (d.repetidaEnArchivo || 0) + (d.datosIncompletos || 0);
  const noCargados = errores + (d.otroEstado || 0);
  if (noCargados) {
    html += encabezadoGrupo('No se cargaron', noCargados, '#c62828');
    if (d.claveInvalida) html += fila('❌', '#c62828', 'problema con la clave de elector', d.claveInvalida);
    if (d.sinDistrito) html += fila('❌', '#c62828', 'sin estado o sin distrito', d.sinDistrito);
    if (d.sinCasilla) html += fila('❌', '#c62828', 'sin estado, sección o casilla', d.sinCasilla);
    if (d.datosIncompletos) html += fila('❌', '#c62828', 'falta vigencia, teléfono, código postal u origen', d.datosIncompletos);
    if (d.repetidaEnArchivo) html += fila('🔁', '#ef6c00', 'repetidas en el archivo (se tomó la última)', d.repetidaEnArchivo);
    if (d.otroEstado) html += fila('🚫', '#ef6c00', 'corresponden a otras casas', d.otroEstado);
  }

  if (!cargados && !noCargados)
    html += fila('ℹ️', '#78909C', 'No hubo filas para procesar', 0, false);

  // --- avisos: NO suman, son un subconjunto de los cargados ---
  const avisos = [];
  if (a.correo) avisos.push(`${n(a.correo)} con correo inválido`);
  if (a.sexo) avisos.push(`${n(a.sexo)} con sexo distinto de Hombre/Mujer`);
  if (avisos.length) {
    // va aparte y sin total propio: si se mostrara como un grupo mas, parecería
    // que suma con los de arriba y la cuenta dejaria de cerrar
    html += `<div style="margin-top:14px;padding:9px 11px;border-radius:8px;
        background:rgba(239,108,0,0.09);font-size:12.5px;color:#ef6c00;
        display:flex;gap:8px;align-items:flex-start;">
      <span>⚠️</span>
      <span><b>Entre los cargados, conviene revisar:</b><br>${avisos.join(' · ')}</span>
    </div>`;
  }

  // --- detalles ---
  const listaErrores = (r.detalle || []).filter((x) => !x.ajena);
  const listaAjenas = (r.detalle || []).filter((x) => x.ajena);
  const linea = (x) => `<li style="margin-bottom:3px;">Fila ${x.fila}: ${x.motivo}</li>`;

  html +=
    bloqueDetalle('Ver qué se modificó', r.cambios, null,
      (x) => `<li style="margin-bottom:4px;"><b>Fila ${x.fila}</b> — ${x.ubicacion}: ${x.texto}</li>`) +
    bloqueDetalle('Ver por qué no se cargaron', listaErrores, errores, linea) +
    bloqueDetalle('Ver las que son de otras casas', listaAjenas, d.otroEstado, linea) +
    bloqueDetalle('Ver qué se cargó con avisos', r.avisosDetalle, null,
      (x) => `<li style="margin-bottom:3px;">Fila ${x.fila}${x.distrito ? ` · ${x.distrito}` : ''}: ${x.texto}</li>`);

  // --- encabezado con la cuenta que tiene que cerrar ---
  const vacias = r.sinResponsable || 0;
  const procesadas = r.filasLeidas - vacias;
  const cabecera = `<div style="font-size:12.5px;color:#78909C;margin-bottom:4px;">
      Se leyeron ${n(r.filasLeidas)} filas${vacias ? ` · ${n(vacias)} sin responsable` : ''} ·
      <b>${n(procesadas)} procesadas</b>${r.segundos ? ` · ${r.segundos} s` : ''}
    </div>`;

  return `<div style="text-align:left;">
    ${cabecera}
    ${html}
    <div style="margin-top:14px;text-align:center;">
      <button id="btn-descargar-resumen" type="button" style="
        background:none;border:1px solid ${SLATE};color:${SLATE};
        border-radius:8px;padding:7px 16px;font-size:13px;font-weight:600;
        cursor:pointer;font-family:inherit;">
        Descargar resumen
      </button>
    </div>
  </div>`;
}

// Se engancha en didOpen y no con un botón propio de SweetAlert para que al
// descargar el resumen NO se cierre el diálogo.
export function conectarDescarga(datos, descargar) {
  const btn = document.getElementById('btn-descargar-resumen');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const nombre = descargar(datos);
    btn.textContent = 'Descargado: ' + nombre;
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'default';
  });
}
