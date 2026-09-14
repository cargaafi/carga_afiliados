import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ReactApexChart from 'react-apexcharts';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { useAuth } from '../Components/AuthContext';
import Swal from 'sweetalert2';
import Grid from '@mui/material/Grid2';
import GraficoCasas from './GraficoCasas';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import { esES } from '@mui/x-data-grid/locales';
import { ThemeProvider, createTheme } from '@mui/material/styles';
//import TreemapCasas from './TreemapCasas';
function ReporteUsuarios() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState([]); // allUsers desde getReporteCompleto
  const [casaData, setCasaData] = useState([]); // casaStats desde getReporteCompleto
  const [topUsers, setTopUsers] = useState([]);
  const [topCasas, setTopCasas] = useState([]);
  const [totalUploads, setTotalUploads] = useState(0);
  const [averageUploads, setAverageUploads] = useState(0);
  const [usuariosActivos, setUsuariosActivos] = useState(0);
  const [casasActivas, setCasasActivas] = useState(0);
  const [promedioPorCasa, setPromedioPorCasa] = useState(0);

  //const { user } = useAuth();

  const cardSx = {
    borderRadius: 3,
    boxShadow:
      '0 12px 30px -18px rgba(143,46,46,0.28), 0 2px 12px rgba(17,17,17,0.06)',
  };

  const kpiChipSx = {
    width: 32,
    height: 32,
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(143,46,46,0.14)',
    color: '#8f2e2e',
  };

  const widgetHeadSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,
    mb: 1.5,
  };

  const widgetTitleSx = { fontSize: 13.5, fontWeight: 600 };

  const widgetMetaSx = { fontSize: 11, color: 'text.secondary' };

  const emptyTextSx = {
    fontSize: 12.5,
    color: 'text.secondary',
    textAlign: 'center',
    py: 4,
  };

  const bordeauxPalette = [
    '#8f2e2e',
    '#b1503f',
    '#c96a56',
    '#d98f6f',
    '#e8b18a',
    '#6b3232',
    '#9c3737',
    '#4f5658',
    '#787878',
    '#a3a3a3',
  ];

  // Tema para DataGrid con idioma español
  const theme = createTheme(
    {
      components: {
        MuiDataGrid: {
          styleOverrides: {
            columnHeader: {
              backgroundColor: '#8f2e2e', // Burdeos para los headers
              '& .MuiSvgIcon-root': {
                color: 'white',
              },
            },
            columnHeaderTitle: {
              color: 'white',
            },
            columnHeaderSortIcon: {
              color: 'white',
            },
            // Para el modo oscuro, asegurar texto blanco
            panel: {
              '&.MuiDataGrid-panelDark, .MuiDataGrid-filterPanelDark': {
                '& .MuiFormLabel-root': {
                  color: 'white', // Etiquetas blancas en modo oscuro
                },
                '& .MuiInputBase-input': {
                  color: 'white', // Texto blanco en inputs en modo oscuro
                },
                '& .MuiInputLabel-root': {
                  color: 'white', // Etiquetas blancas en modo oscuro
                },
                '& .MuiTypography-root': {
                  color: 'white', // Todo texto en blanco en modo oscuro
                },
              },
            },
            // Modo oscuro específico
            root: {
              '&.MuiDataGrid-root--darkMode': {
                '& .MuiDataGrid-cell': {
                  color: 'white',
                },
                '& .MuiTablePagination-root': {
                  color: 'white',
                },
                '& .MuiInputBase-input': {
                  color: 'white',
                },
              },
            },
          },
        },
        // Modificar las etiquetas (MuiInputLabel)
        MuiInputLabel: {
          styleOverrides: {
            root: {
              color: '#8f2e2e', // Gris oscuro para todas las etiquetas
              '&.Mui-focused': {
                color: '#8f2e2e', // Mantener el color cuando está enfocado
              },
              '&.MuiFormLabel-filled': {
                color: '#8f2e2e', // Mantener el color cuando está lleno
              },
              // Para modo oscuro
              '.MuiDataGrid-panelDark &, .Mui-darkMode &': {
                color: 'white',
              },
            },
          },
        },
        // Modificar el Badge
        MuiBadge: {
          styleOverrides: {
            badge: {
              backgroundColor: '#8f2e2e', // Burdeos para el badge
              color: 'white', // Texto blanco en el badge
            },
          },
        },
        // Asegurar texto visible en filtros
        MuiFormLabel: {
          styleOverrides: {
            root: {
              color: '#8f2e2e', // Gris oscuro para etiquetas de formulario
              '&.Mui-focused': {
                color: '#8f2e2e', // Mantener color cuando está enfocado
              },
              // Para modo oscuro
              '.MuiDataGrid-dark &, .MuiDataGrid-panelDark &': {
                color: 'white',
              },
            },
          },
        },
        // Modificar el input para el filtro
        MuiInput: {
          styleOverrides: {
            input: {
              color: '#8f2e2e', // Gris oscuro para el texto
              // Para modo oscuro
              '.Mui-darkMode &, .MuiDataGrid-panelDark &': {
                color: 'white',
              },
            },
            root: {
              '&:before': {
                borderBottomColor: '#8f2e2e',
              },
              '&:hover:not(.Mui-disabled):before': {
                borderBottomColor: '#8f2e2e',
              },
              '&.Mui-focused:after': {
                borderBottomColor: '#8f2e2e',
              },
            },
          },
        },
        // Para los menús desplegables en filtros
        MuiMenu: {
          styleOverrides: {
            paper: {
              '& .MuiMenuItem-root': {
                color: '#333333', // Texto en menús en gris oscuro
              },
              // Para modo oscuro
              '&.MuiMenu-paper-darkMode .MuiMenuItem-root': {
                color: 'white',
              },
            },
          },
        },
      },
      // Configuración de la paleta de colores
      palette: {
        primary: {
          main: '#8f2e2e', // Burdeos como color principal
          dark: '#6e2323', // Versión más oscura para estados hover
        },
        text: {
          primary: '#333333', // Texto primario en gris oscuro
        },
        mode: 'light', // Modo por defecto (puede cambiar a 'dark' si es necesario)
      },
    },
    esES // Localización en español
  );

  // Función que hace la llamada única al backend
  const getReporteCompleto = async () => {
    try {
      const response = await axios.get(`${API_URL}/getReporteCompleto`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
        },
      });
      const { estadisticas, topUsers, allUsers, casaStats, topCasas } =
        response.data;
      setTotalUploads(estadisticas.totalRegistros);
      setAverageUploads(estadisticas.promedioRegistros);
      setUsuariosActivos(estadisticas.usuariosActivos);
      setCasasActivas(estadisticas.casasActivas);
      setPromedioPorCasa(estadisticas.promedioPorCasa);
      setTopUsers(topUsers);
      setTopCasas(topCasas);
      setUserData(allUsers);
      setCasaData(casaStats);
      setLoading(false);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        Swal.fire({
          icon: 'error',
          title: 'Mensaje de seguridad',
          text: 'Su sesión ha expirado, por favor inicie sesión nuevamente',
        });
      } else {
        console.error(err);
        Swal.fire(
          'Ooops',
          'No se pudieron cargar los datos del reporte',
          'error'
        );
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    getReporteCompleto();
  }, []);

  // Definición de columnas para el DataGrid de Usuarios
  const userColumns = [
    { field: 'usuario_subida', headerName: 'Usuario', flex: 1 },
    {
      field: 'registros',
      headerName: 'Registros cargados',
      flex: 1,
      type: 'number',
      align: 'center',
    },
    {
      field: 'ultima_fecha',
      headerName: 'Última carga',
      flex: 1,
      renderCell: (params) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return new Date(date.getTime() - 6 * 60 * 60 * 1000).toLocaleString(
          'es-MX',
          {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }
        );
      },
    },
  ];

  // Definición de columnas para el DataGrid de Casas
  const casaColumns = [
    { field: 'casa', headerName: 'Casa', flex: 1 },
    {
      field: 'registros',
      headerName: 'Registros',
      flex: 1,
      type: 'number',
      align: 'right',
    },
  ];

  // Chrome minimo compartido por los graficos de barras del tablero
  const barChartBase = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '62%',
        borderRadius: 4,
        distributed: true,
        dataLabels: { position: 'bottom' },
      },
    },
    colors: bordeauxPalette,
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      style: { colors: ['#fff'], fontSize: '11px', fontWeight: 700 },
      formatter: (val) => val,
      offsetX: 0,
    },
    stroke: { width: 0 },
    legend: { show: false },
    grid: { show: false, padding: { left: 8, right: 8, top: -8, bottom: -8 } },
    tooltip: {
      theme: 'dark',
      y: { title: { formatter: () => 'Registros:' } },
    },
  };

  // Configuración del gráfico de usuarios
  const userChartOptions = {
    ...barChartBase,
    xaxis: {
      categories: topUsers.map((user) => user.usuario_subida),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        show: true,
        maxWidth: 160,
        style: { colors: '#9aa0a7', fontSize: '11px' },
      },
    },
  };

  const userChartSeries = [
    {
      name: 'Registros',
      data: topUsers.map((user) => user.registros),
    },
  ];

  // Configuración del gráfico de casas
  const casaChartOptions = {
    ...barChartBase,
    xaxis: {
      categories: topCasas.map((casa) => casa.casa),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        show: true,
        maxWidth: 160,
        style: { colors: '#9aa0a7', fontSize: '11px' },
      },
    },
  };

  const casaChartSeries = [
    {
      name: 'Registros',
      data: topCasas.map((casa) => casa.registros),
    },
  ];

  return (
    <>
      <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 1400, mx: 'auto', width: '100%' }}>
        {/* Encabezado */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography sx={{ fontSize: 27, fontWeight: 700, color: '#8f2e2e', m: 0 }}>
            Reporte Casas
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
            Estado general de la carga de afiliados por casa
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              justifyContent: 'center',
              mt: 1.5,
            }}
          >
            <Chip size='small' variant='outlined' label={`${casasActivas} casas activas`} />
            <Chip size='small' variant='outlined' label={`${usuariosActivos} usuarios con carga`} />
          </Box>
        </Box>

        {/* Tarjetas de KPIs */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: '16px 18px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>
                    Total de Registros
                  </Typography>
                  <Box sx={kpiChipSx}>
                    <DescriptionOutlinedIcon sx={{ fontSize: 17 }} />
                  </Box>
                </Box>
                {loading ? (
                  <CircularProgress size={24} style={{ color: '#8f2e2e' }} />
                ) : (
                  <Typography sx={{ fontSize: 25, fontWeight: 700 }}>
                    {totalUploads.toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: '16px 18px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>
                    Casas Activas
                  </Typography>
                  <Box sx={kpiChipSx}>
                    <HomeWorkOutlinedIcon sx={{ fontSize: 17 }} />
                  </Box>
                </Box>
                {loading ? (
                  <CircularProgress size={24} style={{ color: '#8f2e2e' }} />
                ) : (
                  <Typography sx={{ fontSize: 25, fontWeight: 700 }}>
                    {casasActivas}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: '16px 18px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>
                    Promedio por Usuario
                  </Typography>
                  <Box sx={kpiChipSx}>
                    <PersonOutlineOutlinedIcon sx={{ fontSize: 17 }} />
                  </Box>
                </Box>
                {loading ? (
                  <CircularProgress size={24} style={{ color: '#8f2e2e' }} />
                ) : (
                  <Typography sx={{ fontSize: 25, fontWeight: 700 }}>
                    {Math.round(averageUploads).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: '16px 18px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>
                    Promedio por Casa
                  </Typography>
                  <Box sx={kpiChipSx}>
                    <GridViewOutlinedIcon sx={{ fontSize: 17 }} />
                  </Box>
                </Box>
                {loading ? (
                  <CircularProgress size={24} style={{ color: '#8f2e2e' }} />
                ) : (
                  <Typography sx={{ fontSize: 25, fontWeight: 700 }}>
                    {Math.round(promedioPorCasa).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        {/* Fila de graficos + detalle de control */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ ...cardSx, height: '100%' }}>
              <CardContent sx={{ p: '14px 16px !important' }}>
                <Box sx={widgetHeadSx}>
                  <Typography sx={widgetTitleSx}>Top Casas</Typography>
                  <Typography sx={widgetMetaSx}>registros cargados</Typography>
                </Box>
                {topCasas.length > 0 ? (
                  <ReactApexChart
                    options={casaChartOptions}
                    series={casaChartSeries}
                    type='bar'
                    height={Math.max(150, topCasas.length * 34 + 40)}
                    width='100%'
                  />
                ) : (
                  <Typography sx={emptyTextSx}>Sin datos para el gráfico</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ ...cardSx, height: '100%' }}>
              <CardContent sx={{ p: '14px 16px !important' }}>
                <Box sx={widgetHeadSx}>
                  <Typography sx={widgetTitleSx}>Top Usuarios</Typography>
                  <Typography sx={widgetMetaSx}>registros cargados</Typography>
                </Box>
                {topUsers.length > 0 ? (
                  <ReactApexChart
                    options={userChartOptions}
                    series={userChartSeries}
                    type='bar'
                    height={Math.max(150, topUsers.length * 34 + 40)}
                    width='100%'
                  />
                ) : (
                  <Typography sx={emptyTextSx}>Sin datos para el gráfico</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ ...cardSx, height: '100%' }}>
              <CardContent sx={{ p: '14px 16px !important' }}>
                <Box sx={widgetHeadSx}>
                  <Typography sx={widgetTitleSx}>Listado de Usuarios</Typography>
                  <Typography sx={widgetMetaSx}>
                    {userData.length} usuarios
                  </Typography>
                </Box>
                <ThemeProvider theme={theme}>
                  <DataGrid
                    autoHeight
                    rows={userData}
                    columns={userColumns}
                    loading={loading}
                    disableSelectionOnClick
                    density='compact'
                    localeText={{
                      toolbarExport: 'Exportar',
                      toolbarDensity: 'Densidad',
                      toolbarColumns: 'Columnas',
                      footerRowSelected: (count) =>
                        count !== 1
                          ? `${count} filas seleccionadas`
                          : '1 fila seleccionada',
                      footerTotalRows: 'Total de filas:',
                      MuiTablePagination: {
                        labelRowsPerPage: 'Filas por página',
                      },
                    }}
                    pageSizeOptions={[5, 10, 20]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 5 } },
                      sorting: {
                        sortModel: [{ field: 'registros', sort: 'desc' }],
                      },
                    }}
                  />
                </ThemeProvider>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Fila de listados */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ ...cardSx, height: '100%' }}>
              <CardContent sx={{ p: '14px 16px !important' }}>
                <Box sx={widgetHeadSx}>
                  <Typography sx={widgetTitleSx}>Registros por Casas</Typography>
                  <Typography sx={widgetMetaSx}>Excel vs cargados</Typography>
                </Box>
                <GraficoCasas />
                {/*  <TreemapCasas /> sacar comentario para grafico */}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ ...cardSx, height: '100%' }}>
              <CardContent sx={{ p: '14px 16px !important' }}>
                <Box sx={widgetHeadSx}>
                  <Typography sx={widgetTitleSx}>Listado de Casas</Typography>
                  <Typography sx={widgetMetaSx}>
                    {casaData.length} casas
                  </Typography>
                </Box>
                <ThemeProvider theme={theme}>
                  <DataGrid
                    autoHeight
                    rows={casaData}
                    columns={casaColumns}
                    loading={loading}
                    disableSelectionOnClick
                    density='compact'
                    pageSizeOptions={[5, 10, 20]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 5 } },
                      sorting: {
                        sortModel: [{ field: 'registros', sort: 'desc' }],
                      },
                    }}
                  />
                </ThemeProvider>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}

export default ReporteUsuarios;
