import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, TextField, Button, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { DataGrid, GridToolbarContainer, GridToolbarFilterButton } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import axios from 'axios';
import Swal from 'sweetalert2';
import { API_URL } from '../Config/Config';
import { SLATE } from './SelectorModulo';

const columnas = [
  { field: 'estado', headerName: 'Estado', width: 170 },
  { field: 'seccion_electoral_ubic', headerName: 'Sección', width: 90, align: 'center', headerAlign: 'center' },
  { field: 'tipo_casilla', headerName: 'Tipo', width: 70, align: 'center', headerAlign: 'center' },
  { field: 'casilla', headerName: 'Casilla', width: 90, align: 'center', headerAlign: 'center' },
  { field: 'cargo', headerName: 'Cargo', width: 130 },
  { field: 'municipio', headerName: 'Municipio', width: 160 },
  { field: 'distrito_federal', headerName: 'Dto. Fed.', width: 90, align: 'center', headerAlign: 'center' },
  { field: 'apellido_paterno', headerName: 'Apellido Paterno', width: 150 },
  { field: 'apellido_materno', headerName: 'Apellido Materno', width: 150 },
  { field: 'nombre', headerName: 'Nombre(s)', width: 150 },
  { field: 'sexo', headerName: 'Sexo', width: 85 },
  { field: 'clave_elector', headerName: 'Clave de Elector', width: 180 },
  { field: 'vigencia_ine', headerName: 'Vigencia', width: 90, align: 'center', headerAlign: 'center' },
  { field: 'telefono', headerName: 'Teléfono', width: 120 },
  { field: 'correo', headerName: 'Correo', width: 200 },
  { field: 'municipio_domicilio', headerName: 'Municipio dom.', width: 150 },
  { field: 'codigo_postal', headerName: 'C.P.', width: 80 },
  { field: 'origen', headerName: 'Origen', width: 120 },
  { field: 'casa_carga', headerName: 'Casa', width: 75, align: 'center', headerAlign: 'center' },
  { field: 'usuario_subida', headerName: 'Cargado por', width: 140 },
  {
    field: 'fecha_subida',
    headerName: 'Última carga',
    width: 160,
    renderCell: (p) =>
      p.value ? new Date(p.value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '',
  },
];

export default function GrillaRC() {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [paginado, setPaginado] = useState({ page: 0, pageSize: 50 });
  const [busqueda, setBusqueda] = useState('');
  const [consulta, setConsulta] = useState('');
  const [exportando, setExportando] = useState(false);
  const temaApp = useTheme();

  // Paginado del lado del servidor: son hasta 173 mil filas, no se pueden
  // traer todas al navegador como hace RD con sus 300.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    axios
      .get(`${API_URL}/rcListado`, {
        params: { page: paginado.page, pageSize: paginado.pageSize, q: consulta || undefined },
      })
      .then((r) => {
        if (!vigente) return;
        setFilas(r.data.data || []);
        setTotal(r.data.total || 0);
        setError(null);
      })
      .catch((e) => vigente && setError(e.response?.data?.message || 'No se pudo cargar el listado'))
      .finally(() => vigente && setCargando(false));
    // si el usuario pagina rápido, la respuesta vieja no debe pisar a la nueva
    return () => { vigente = false; };
  }, [paginado.page, paginado.pageSize, consulta]);

  const buscar = useCallback(() => {
    setPaginado((p) => ({ ...p, page: 0 }));
    setConsulta(busqueda.trim());
  }, [busqueda]);

  // El endpoint pide token, así que no sirve un enlace directo: hay que
  // traerlo con la cabecera y armar la descarga a mano.
  const exportar = async () => {
    setExportando(true);
    try {
      const r = await axios.get(`${API_URL}/rcExportar`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Responsables_de_Casilla_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo exportar',
        text: 'Intenta de nuevo en un momento',
        confirmButtonColor: SLATE,
      });
    } finally {
      setExportando(false);
    }
  };

  const Toolbar = () => (
    <GridToolbarContainer sx={{ p: 1, gap: 1, flexWrap: 'wrap' }}>
      <GridToolbarFilterButton />
      <Button
        size='small'
        startIcon={<FileDownloadOutlinedIcon />}
        onClick={exportar}
        disabled={exportando || !total}
        sx={{ textTransform: 'none' }}
      >
        {exportando ? 'Preparando…' : 'Exportar CSV'}
      </Button>
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', alignSelf: 'center' }}>
        {total.toLocaleString('es-MX')} registros
      </Typography>
    </GridToolbarContainer>
  );

  const tema = createTheme(
    {
      palette: { mode: temaApp.palette.mode, primary: { main: SLATE } },
      components: {
        MuiDataGrid: {
          styleOverrides: {
            columnHeader: {
              backgroundColor: SLATE,
              color: '#ffffff',
              '& .MuiSvgIcon-root': { color: '#ffffff' },
            },
            columnHeaderTitle: { color: '#ffffff', fontWeight: 600 },
          },
        },
      },
    },
    esES
  );

  if (error) {
    return <Typography sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>{error}</Typography>;
  }

  return (
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <TextField
          size='small'
          placeholder='Buscar por nombre, clave, sección o casilla'
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          onBlur={buscar}
          sx={{ width: '100%', maxWidth: 420, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <SearchIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <ThemeProvider theme={tema}>
        <DataGrid
          autoHeight
          rows={filas}
          columns={columnas}
          loading={cargando}
          density='compact'
          disableRowSelectionOnClick
          slots={{ toolbar: Toolbar }}
          paginationMode='server'
          rowCount={total}
          paginationModel={paginado}
          onPaginationModelChange={setPaginado}
          pageSizeOptions={[25, 50, 100, 200]}
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: consulta
              ? 'Ningún responsable coincide con la búsqueda'
              : 'Todavía no hay responsables cargados',
          }}
          sx={{
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        />
      </ThemeProvider>
    </Box>
  );
}
