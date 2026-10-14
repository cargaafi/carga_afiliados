// Genera el .txt que se descarga desde el popup de resumen.
// Lo usan RD y RG, asi que el formato es uno solo.

const dosDigitos = (n) => String(n).padStart(2, '0');

// resumen-RD-Casa_1-2026-10-14_1532.txt
// El modulo y la casa al principio para que agrupen al ordenar por nombre, y
// la fecha con guiones porque los dos puntos no son validos en Windows.
export function nombreArchivo(modulo, usuario, fecha = new Date()) {
  const f =
    `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}` +
    `_${dosDigitos(fecha.getHours())}${dosDigitos(fecha.getMinutes())}`;
  const limpio = String(usuario || 'usuario').replace(/[^A-Za-z0-9_-]/g, '');
  return `resumen-${modulo}-${limpio}-${f}.txt`;
}

const linea = (etiqueta, valor) =>
  `  ${String(etiqueta).padEnd(34, '.')} ${String(valor).padStart(8)}`;

const titulo = (t) => `\n${t}\n${'-'.repeat(52)}`;

export function armarTexto({ modulo, resumen: r, usuario, archivo, fecha = new Date() }) {
  const L = [];
  const d = r.descartados || {};
  const a = r.avisos || {};
  const procesadas = r.filasLeidas - (r.sinResponsable || 0);

  L.push(`RESUMEN DE CARGA - ${modulo}`);
  L.push('='.repeat(52));
  L.push(`  Archivo:  ${archivo || '(sin nombre)'}`);
  L.push(`  Usuario:  ${usuario || '(desconocido)'}`);
  L.push(`  Fecha:    ${fecha.toLocaleString('es-MX')}`);
  if (r.entidadUsuario) L.push(`  Alcance:  ${r.entidadUsuario}`);
  if (r.segundos) L.push(`  Duración: ${r.segundos} s`);

  L.push(titulo('TOTALES'));
  L.push(linea('Filas leídas', r.filasLeidas));
  L.push(linea('Filas procesadas', procesadas));
  if (r.sinResponsable) L.push(linea('Filas sin responsable (vacías)', r.sinResponsable));

  L.push(titulo('SE CARGARON'));
  L.push(linea('Nuevos', r.nuevos || 0));
  L.push(linea('Actualizados', r.actualizados || 0));
  L.push(linea('Con responsable reemplazado', r.reemplazados || 0));
  L.push(linea('Sin cambios', r.sinCambios || 0));

  const noCargados =
    (d.claveInvalida || 0) + (d.sinDistrito || 0) + (d.sinCasilla || 0) + (d.otroEstado || 0);
  if (noCargados || d.repetidaEnArchivo) {
    L.push(titulo('NO SE CARGARON'));
    if (d.claveInvalida) L.push(linea('Problema con la clave de elector', d.claveInvalida));
    if (d.sinDistrito) L.push(linea('Sin estado o sin distrito', d.sinDistrito));
    if (d.sinCasilla) L.push(linea('Sin estado, sección o casilla', d.sinCasilla));
    if (d.otroEstado) L.push(linea('Corresponden a otras casas', d.otroEstado));
    if (d.repetidaEnArchivo)
      L.push(linea('Repetidas en el archivo (gana la última)', d.repetidaEnArchivo));
  }

  const hayAvisos = a.vigenciaVencida || a.vigencia || a.sexo || a.telefono || a.correo;
  if (hayAvisos) {
    L.push(titulo('SE CARGARON IGUAL, PERO CONVIENE REVISAR'));
    if (a.vigenciaVencida) L.push(linea('INE vencida', a.vigenciaVencida));
    if (a.vigencia) L.push(linea('Sin vigencia de INE', a.vigencia));
    if (a.sexo) L.push(linea('Sexo distinto de Hombre/Mujer', a.sexo));
    if (a.telefono) L.push(linea('Teléfono inválido', a.telefono));
    if (a.correo) L.push(linea('Correo inválido', a.correo));
  }

  // El servidor manda como máximo 50 de cada lista: con 170 mil descartes no
  // tiene sentido mandarlos todos. Se avisa para que nadie crea que son todos.
  const bloque = (tit, lista, total, render) => {
    if (!lista || !lista.length) return;
    const recortado = total && total > lista.length;
    L.push(titulo(tit + (recortado ? ` (los primeros ${lista.length} de ${total})` : ` (${lista.length})`)));
    for (const x of lista) L.push('  ' + render(x));
    if (recortado) L.push(`\n  [...] se omitieron ${total - lista.length} más.`);
  };

  bloque('DETALLE DE LO QUE NO SE CARGÓ', r.detalle, noCargados + (d.repetidaEnArchivo || 0),
    (x) => `Fila ${x.fila}: ${x.motivo}`);

  bloque('DETALLE DE LO QUE SE CARGÓ CON AVISOS', r.avisosDetalle, null,
    (x) => `Fila ${x.fila}${x.distrito ? ` · ${x.distrito}` : ''}: ${x.texto}`);

  bloque('QUÉ SE MODIFICÓ', r.cambios, null,
    (x) => `Fila ${x.fila} — ${x.ubicacion}: ${x.texto}`);

  L.push('');
  return L.join('\n');
}

export function descargarResumen(datos) {
  const texto = armarTexto(datos);
  const nombre = nombreArchivo(datos.modulo, datos.usuario, datos.fecha);
  // BOM al principio para que el Bloc de notas de Windows respete los acentos
  const blob = new Blob(['﻿' + texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // sin esto el blob queda en memoria hasta que se cierre la pestaña
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nombre;
}
