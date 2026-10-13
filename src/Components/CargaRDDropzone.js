import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Card, CardContent, Typography, Button, CircularProgress, Chip } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import Swal from 'sweetalert2';
import { API_URL } from '../Config/Config';

const SLATE = '#455A64';
const SLATE_HOVER = '#37474F';

function filaResumen(icono, color, texto) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:14px;">
    <span style="width:22px;text-align:center;">${icono}</span>
    <span style="color:${color};text-align:left;flex:1;">${texto}</span>
  </div>`;
}

function armarResumenHtml(r) {
  const filas = [];
  if (r.nuevos) filas.push(filaResumen('✅', '#2e7d32', `<b>${r.nuevos}</b> nuevos`));
  if (r.actualizados) filas.push(filaResumen('🔄', '#455A64', `<b>${r.actualizados}</b> actualizados`));
  if (r.reemplazados) filas.push(filaResumen('👤', '#455A64', `<b>${r.reemplazados}</b> con responsable reemplazado`));
  if (r.sinCambios) filas.push(filaResumen('⏸️', '#78909C', `<b>${r.sinCambios}</b> sin cambios`));

  const d = r.descartados || {};
  if (d.claveInvalida) filas.push(filaResumen('❌', '#c62828', `<b>${d.claveInvalida}</b> descartados — problema con la clave de elector`));
  if (d.sinDistrito) filas.push(filaResumen('❌', '#c62828', `<b>${d.sinDistrito}</b> descartados — sin estado o sin distrito`));
  if (d.otroEstado) filas.push(filaResumen('🚫', '#ef6c00', `<b>${d.otroEstado}</b> descartados — no son de tu casa (${r.entidadUsuario})`));

  const a = r.avisos || {};
  const avisos = [];
  if (a.vigencia) avisos.push(`${a.vigencia} con INE vencido`);
  if (a.telefono) avisos.push(`${a.telefono} con teléfono inválido`);
  if (a.correo) avisos.push(`${a.correo} con correo inválido`);
  if (a.sexo) avisos.push(`${a.sexo} con sexo distinto de Hombre/Mujer`);
  if (avisos.length)
    filas.push(filaResumen('⚠️', '#ef6c00', `Se cargaron igual: ${avisos.join(' · ')}`));

  if (!filas.length) filas.push(filaResumen('ℹ️', '#78909C', 'No hubo filas para procesar'));

  let detalle = '';
  if (r.detalle && r.detalle.length) {
    const items = r.detalle
      .map((x) => `<li style="margin-bottom:3px;">Fila ${x.fila}: ${x.motivo}</li>`)
      .join('');
    detalle = `<details style="margin-top:14px;border-top:1px solid #e0e0e0;padding-top:10px;">
      <summary style="cursor:pointer;font-size:13px;color:#455A64;">
        Ver detalle de los descartados (${r.detalle.length})
      </summary>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:12px;color:#546E7A;max-height:180px;overflow:auto;">
        ${items}
      </ul>
    </details>`;
  }

  const conDatos = r.filasLeidas - (r.sinResponsable || 0);
  return `<div style="text-align:left;">
    <div style="font-size:12.5px;color:#78909C;margin-bottom:10px;">
      Se leyeron ${r.filasLeidas} filas · ${conDatos} procesadas
    </div>
    ${filas.join('')}
    ${detalle}
  </div>`;
}

export default function CargaRDDropzone() {
  const [subiendo, setSubiendo] = useState(false);

  const { acceptedFiles, getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  });

  const archivo = acceptedFiles[0];

  const handleUpload = async () => {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('file', archivo);
      const res = await axios.post(`${API_URL}/uploadRD`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      acceptedFiles.length = 0;
      Swal.fire({
        icon: 'success',
        title: 'Carga procesada',
        html: armarResumenHtml(res.data.resumen),
        confirmButtonColor: SLATE,
        confirmButtonText: 'Aceptar',
        width: 540,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo procesar',
        text: error.response?.data?.message || 'Error al subir el archivo',
        confirmButtonColor: SLATE,
        confirmButtonText: 'Aceptar',
      });
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: 820, mx: 'auto', p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: 27, fontWeight: 700, color: SLATE }}>
          Carga de Responsables de Distrito
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
          Subí el Excel con la hoja "Responsables de Distrito"
        </Typography>
      </Box>

      <Card
        sx={{
          borderRadius: 3,
          boxShadow: '0 12px 40px -16px rgba(69,90,100,0.22), 0 2px 12px rgba(17,17,17,0.06)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? SLATE : 'divider',
              borderRadius: 3,
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive ? 'rgba(69,90,100,0.06)' : 'transparent',
              transition: 'border-color .15s, background-color .15s',
            }}
          >
            <input {...getInputProps()} />
            <UploadFileIcon sx={{ fontSize: 44, color: SLATE, mb: 1 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
              {isDragActive ? 'Soltá el archivo acá' : 'Arrastrá el Excel o hacé click para elegirlo'}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>
              Solo archivos .xlsx
            </Typography>
          </Box>

          {archivo && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mt: 2.5,
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'rgba(69,90,100,0.06)',
              }}
            >
              <DescriptionOutlinedIcon sx={{ color: SLATE }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {archivo.name}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {(archivo.size / 1024 / 1024).toFixed(1)} MB
                </Typography>
              </Box>
              <Chip size='small' variant='outlined' label='listo para subir' />
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant='contained'
              disabled={!archivo || subiendo}
              onClick={handleUpload}
              sx={{
                borderRadius: '10px',
                px: 4,
                py: 1.2,
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: SLATE,
                boxShadow: 'none',
                '&:hover': { backgroundColor: SLATE_HOVER, boxShadow: 'none' },
              }}
            >
              {subiendo ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Cargar archivo'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
