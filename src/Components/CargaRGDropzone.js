import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Card, CardContent, Typography, Button, CircularProgress, Chip, LinearProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import Swal from 'sweetalert2';
import { API_URL } from '../Config/Config';
import { useAuth } from './AuthContext';
import { descargarResumen } from './resumenDescarga';
import { armarResumenHtml, conectarDescarga } from './resumenHtml';

const SLATE = '#455A64';
const SLATE_HOVER = '#37474F';

export default function CargaRGDropzone() {
  const { user } = useAuth();
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [fase, setFase] = useState('');
  const [detalleAvance, setDetalleAvance] = useState('');

  const { acceptedFiles, getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  });

  const archivo = acceptedFiles[0];

  // Mientras el servidor procesa, le preguntamos cómo va. Son 173 mil filas:
  // sin esto el usuario mira una barra quieta sin saber si se colgó.
  const seguirAvance = () => {
    const id = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/upload-progress`);
        if (data && typeof data.progress === 'number' && data.progress > 0) {
          setProgreso(data.progress);
          // el servidor ya terminó de leer y está escribiendo en la base:
          // antes este tramo quedaba mudo (la barra se congelaba sin avisar)
          if (data.fase === 'guardando') setFase('Guardando en la base');
          const r = data.estimatedRemaining;
          const falta = r && (r.minutes || r.seconds)
            ? `faltan ${r.minutes ? `${r.minutes} min ` : ''}${r.seconds} s`
            : '';
          setDetalleAvance([data.speed ? `${Math.round(data.speed)} filas/s` : '', falta].filter(Boolean).join(' · '));
        }
      } catch (_) {
        /* si falla el sondeo no pasa nada: la carga sigue */
      }
    }, 700);
    return () => clearInterval(id);
  };

  const handleUpload = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setProgreso(0);
    setDetalleAvance('');
    setFase('Subiendo archivo');
    let detener = null;
    try {
      const formData = new FormData();
      formData.append('file', archivo);
      const res = await axios.post(`${API_URL}/uploadRG`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgreso(pct);
          if (pct >= 100 && !detener) {
            setFase('Procesando el Excel');
            setProgreso(0);
            detener = seguirAvance();
          }
        },
      });
      if (detener) detener();
      // antes el cartel aparecía de golpe apenas respondía el servidor,
      // sin importar en qué número se había quedado la barra. Ahora se ve
      // llegar a 100% y se sostiene un instante antes de abrir el resumen.
      setFase('Completado');
      setProgreso(100);
      setDetalleAvance('');
      await new Promise((r) => setTimeout(r, 450));
      const nombreArchivoSubido = archivo.name;
      acceptedFiles.length = 0;
      Swal.fire({
        icon: 'success',
        title: 'Carga procesada',
        html: armarResumenHtml(res.data.resumen),
        confirmButtonColor: SLATE,
        confirmButtonText: 'Aceptar',
        width: 560,
        didOpen: () =>
          conectarDescarga({
            modulo: 'RG',
            resumen: res.data.resumen,
            usuario: user?.username,
            archivo: nombreArchivoSubido,
          }, descargarResumen),
      });
    } catch (error) {
      if (detener) detener();
      Swal.fire({
        icon: 'error',
        title: 'No se pudo procesar',
        text: error.response?.data?.message || 'Error al subir el archivo',
        confirmButtonColor: SLATE,
        confirmButtonText: 'Aceptar',
      });
    } finally {
      setSubiendo(false);
      setProgreso(0);
      setFase('');
      setDetalleAvance('');
    }
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: 820, mx: 'auto', p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: 27, fontWeight: 700, color: SLATE }}>
          Carga de RG
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
          Puedes subir un Excel individual de RG o el completo con todas las
          pestañas: el sistema busca la hoja de RG y cargará solamente esa.
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
              {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra el Excel o haz clic para elegirlo'}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>
              Solo archivos .xlsx
            </Typography>
          </Box>

          {archivo && (
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, mt: 2.5, p: 1.5,
                borderRadius: 2, backgroundColor: 'rgba(69,90,100,0.06)',
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

          {subiendo && (
            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                  {fase}
                  {fase === 'Procesando el Excel' || fase === 'Guardando en la base' ? '…' : ''}
                  {detalleAvance ? ` · ${detalleAvance}` : ''}
                </Typography>
                {progreso > 0 && (
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: SLATE }}>
                    {progreso}%
                  </Typography>
                )}
              </Box>
              <LinearProgress
                variant={progreso > 0 ? 'determinate' : 'indeterminate'}
                value={progreso}
                sx={{
                  height: 8, borderRadius: 4,
                  backgroundColor: 'rgba(69,90,100,0.14)',
                  '& .MuiLinearProgress-bar': { borderRadius: 4, backgroundColor: SLATE },
                }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant='contained'
              disabled={!archivo || subiendo}
              onClick={handleUpload}
              sx={{
                borderRadius: '10px', px: 4, py: 1.2, textTransform: 'none',
                fontWeight: 600, backgroundColor: SLATE, boxShadow: 'none',
                '&:hover': { backgroundColor: SLATE_HOVER, boxShadow: 'none' },
              }}
            >
              {subiendo ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Procesar Excel'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
