import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { DataGrid, GridToolbarContainer, GridToolbarFilterButton, GridToolbarExport } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { SLATE } from './SelectorModulo';

const columnas = [
  { field: 'estado', headerName: 'Estado', width: 180 },
  { field: 'distrito_federal', headerName: 'Distrito', width: 90, type: 'number', align: 'center', headerAlign: 'center' },
  { field: 'cabecera', headerName: 'Cabecera', width: 180 },
  { field: 'apellido_paterno', headerName: 'Apellido Paterno', width: 150 },
  { field: 'apellido_materno', headerName: 'Apellido Materno', width: 150 },
  { field: 'nombre', headerName: 'Nombre(s)', width: 150 },
  { field: 'sexo', headerName: 'Sexo', width: 90 },
  { field: 'clave_elector', headerName: 'Clave de Elector', width: 180 },
  { field: 'vigencia_ine', headerName: 'Vigencia', width: 90, align: 'center', headerAlign: 'center' },
  { field: 'telefono', headerName: 'Teléfono', width: 120 },
  { field: 'correo', headerName: 'Correo', width: 200 },
  { field: 'municipio_domicilio', headerName: 'Municipio', width: 150 },
  { field: 'codigo_postal', headerName: 'C.P.', width: 80 },
  { field: 'seccion_electoral', headerName: 'Sección', width: 90 },
  { field: 'casa_carga', headerName: 'Casa', width: 80, align: 'center', headerAlign: 'center' },
  { field: 'usuario_subida', headerName: 'Cargado por', width: 140 },
  {
    field: 'fecha_subida',
    headerName: 'Última carga',
    width: 160,
    renderCell: (params) =>
      params.value
        ? new Date(params.value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
        : '',
  },
];

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ p: 1 }}>
      <GridToolbarFilterButton />
      <GridToolbarExport csvOptions={{ fileName: 'Responsables_de_Distrito', utf8WithBom: true }} />
    </GridToolbarContainer>
  );
}

export default function GrillaRD() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const temaApp = useTheme();

  useEffect(() => {
    axios
      .get(`${API_URL}/rdListado`)
      .then((r) => setFilas(r.data.data || []))
      .catch((e) => setError(e.response?.data?.message || 'No se pudo cargar el listado'))
      .finally(() => setCargando(false));
  }, []);

  // respeta el modo claro/oscuro de la app y pinta los encabezados
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
    // overflow hidden: corta la propagacion del ancho minimo de las columnas,
    // si no la grilla estira el layout del dashboard
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <ThemeProvider theme={tema}>
        <DataGrid
          autoHeight
          rows={filas}
          columns={columnas}
          loading={cargando}
          density='compact'
          disableRowSelectionOnClick
          slots={{ toolbar: Toolbar }}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          // el prop pisa el localeText del tema, asi que hay que traer el
          // español completo y recien ahi cambiar el mensaje de "sin filas"
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: 'Todavía no hay responsables cargados',
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
