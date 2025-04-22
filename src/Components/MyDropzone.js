import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  List,
  ListItem,
  Button,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { useAuth } from '../Components/AuthContext';
import Swal from 'sweetalert2';
import { LinearProgress } from '@mui/material';
function MyDropzone() {
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploader, setShowUploader] = useState(true);
  const { user } = useAuth();

  const { acceptedFiles, getRootProps, getInputProps, isDragActive } =
    useDropzone({
      accept: {
        'application/vnd.ms-excel': ['.xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
          '.xlsx',
        ],
        'text/csv': ['.csv'],
      },
    });

  // Nuevo hook para seguir el progreso
  useEffect(() => {
    let intervalId;
    if (isUploading) {
      intervalId = setInterval(async () => {
        try {
          const response = await axios.get(`${API_URL}/upload-progress`);
          setUploadProgress(response.data);
        } catch (error) {
          console.error('Error obteniendo progreso:', error);
          clearInterval(intervalId);
        }
      }, 3200);
    }

    // Limpiar intervalo al desmontar o cuando deje de subir
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isUploading]);
  // Función para resetear el componente
  const handleReset = () => {
    setUploadResult(null);
    setShowUploader(true);
    acceptedFiles.length = 0; // Limpia los archivos seleccionados
  };

  const handleUpload = async () => {
    if (!acceptedFiles.length) {
      alert('No hay archivos para subir');
      return;
    }

    const usuario = user.username;
    try {
      setIsUploading(true);
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('usuario', usuario);

      const res = await axios.post(`${API_URL}/uploadfile`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult(res.data);
      setShowUploader(false); // Oculta el uploader después de subir
    } catch (error) {
      console.error('Error al subir el archivo:', error);

      // Formatear el mensaje de error para la alerta
      let errorMessage = 'Error al subir el archivo.';
      let errorDetails = '';

      if (error.response && error.response.data) {
        errorMessage = error.response.data.message || errorMessage;

        // Verificar si hay mensajes de error detallados
        if (error.response.data.mensajeErrores) {
          errorDetails = error.response.data.mensajeErrores;
        }
      } else if (error.message) {
        // Para errores de red u otros errores que no vengan del servidor
        errorMessage = error.message;
      }

      // Usar SweetAlert para mostrar el error
      if (errorDetails) {
        // Si hay detalles, mostrar un mensaje más elaborado
        Swal.fire({
          title: 'Error',
          html: `
            <p>${errorMessage}</p>
            <div style="max-height: 300px; overflow-y: auto; text-align: left; margin-top: 15px; padding: 10px; background: #f8f8f8; border: 1px solid #e0e0e0;">
              <pre style="white-space: pre-wrap; font-size: 0.9em;">${errorDetails}</pre>
            </div>
          `,
          icon: 'error',
          confirmButtonColor: '#8f2e2e',
          width: '600px',
        });
      } else {
        Swal.fire({
          title: 'Error',
          text: errorMessage,
          icon: 'error',
          confirmButtonColor: '#8f2e2e',
        });
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <Box>
      {showUploader ? (
        // Área de subida de archivos
        <Box
          sx={{
            border: '2px dashed #ccc',
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#8f2e2e24' },
          }}
        >
          <Typography variant='h4' sx={{ color: '#8f2e2e', mb: 2 }}>
            Carga de Archivos
          </Typography>
          <Box
            {...getRootProps()}
            sx={{
              p: 2,
              borderRadius: 1,
              backgroundColor: isDragActive ? '#eee' : 'transparent',
            }}
          >
            <input {...getInputProps()} />
            <Typography>
              {isDragActive
                ? '¡Suelta el archivo aquí!'
                : 'Arrastra o haz clic para subir archivos (XLS, XLSX o CSV)'}
            </Typography>
          </Box>

          {acceptedFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant='h6'>Archivo(s) seleccionado(s):</Typography>
              <List sx={{ pl: 2 }}>
                {acceptedFiles.map((file) => (
                  <ListItem key={file.path || file.name}>
                    {file.path || file.name} - {file.size} bytes
                  </ListItem>
                ))}
              </List>
              <Button
                variant='contained'
                onClick={handleUpload}
                disabled={isUploading}
                sx={{ mt: 1, bgcolor: '#8f2e2e' }}
              >
                {isUploading ? (
                  <>
                    {' '}
                    <CircularProgress
                      size={15}
                      style={{ color: '#8f2e2e', marginRight: '3px' }}
                    />{' '}
                    Subiendo...{' '}
                  </>
                ) : (
                  'Subir Archivo'
                )}
              </Button>
            </Box>
          )}

          {isUploading && (
            <>
              {uploadProgress && uploadProgress.progress > 0 ? (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    align='center'
                  >
                    Progreso: {uploadProgress.progress}%
                  </Typography>
                  <LinearProgress
                    variant='determinate'
                    value={uploadProgress.progress}
                    sx={{
                      mt: 1,
                      '& .MuiLinearProgress-bar1Determinate': {
                        backgroundColor: '#8f2e2e',
                        color: 'red'
                      },
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mt: 1,
                    }}
                  >
                    <Typography variant='body2' color='text.secondary'>
                      Velocidad: {uploadProgress.speed} registros/segundo
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Tiempo restante:{' '}
                      {uploadProgress.estimatedRemaining.minutes} min{' '}
                      {uploadProgress.estimatedRemaining.seconds} seg
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    mt: 2,
                  }}
                ></Box>
              )}
            </>
          )}
        </Box>
      ) : null}

      {/* Resultados en Card */}
      {uploadResult && (
        <Card
          elevation={3}
          sx={{
            mt: 3,
            backgroundColor: '#fff',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {/* Banner de éxito */}
          <Box
            sx={{
              p: 0,
              color: '#4caf50',
              textAlign: 'center',
            }}
          >
            <Typography variant='h5' fontWeight='bold'>
              ¡Archivo cargado correctamente!
            </Typography>
          </Box>

          <CardContent sx={{ p: 2 }}>
            {/* Estadísticas principales */}
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                mb: 4,
                p: 3,
                backgroundColor: '#f8f9fa',
                borderRadius: 2,
              }}
            >
              <Typography
                variant='h6'
                sx={{ borderBottom: '2px solid #e0e0e0', pb: 1 }}
              >
                Filas con datos totales leídas:{' '}
                <strong>{uploadResult?.totalFilasConDatos}</strong>
              </Typography>

              {/* Errores y advertencias */}
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Typography
                  sx={{
                    color: '#d32f2f',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  Claves de Elector Inválidas (longitud diferente a 18):{' '}
                  <strong style={{ marginLeft: '8px' }}>
                    {uploadResult?.claveElectorInvalida}
                  </strong>
                </Typography>
                <Typography
                  sx={{
                    color: '#ed6c02',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  Total de Registros Duplicados en el Archivo:{' '}
                  <strong style={{ marginLeft: '8px' }}>
                    {uploadResult?.duplicadosTotales}
                  </strong>
                </Typography>

                <Typography
                  sx={{
                    color: '#ed6c02',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  Claves duplicadas con Registros en la Base de Datos:{' '}
                  <strong style={{ marginLeft: '8px' }}>
                    {uploadResult?.duplicadosConExistentes}
                  </strong>
                </Typography>
              </Box>
            </Box>

            {/* Resultados exitosos */}
            <Box
              sx={{
                bgcolor: '#e8f5e9',
                p: 3,
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Typography
                variant='h6'
                color='success.main'
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                Registros insertados exitosamente:
                <strong style={{ marginLeft: '8px', fontSize: '24px' }}>
                  {uploadResult?.insertadasExitosamente}
                </strong>
              </Typography>
            </Box>

            {/* Botón centrado */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant='contained'
                onClick={handleReset}
                sx={{
                  bgcolor: '#8f2e2e',
                  '&:hover': { bgcolor: '#732525' },
                  minWidth: '200px',
                  py: 1,
                  fontSize: '1rem',
                }}
              >
                Cargar otro archivo
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default MyDropzone;
