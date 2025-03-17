import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
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
  const [tabValue, setTabValue] = useState(0);
  const [tabValueGrafico, setTabValueGrafico] = useState(0);

  //const { user } = useAuth();
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

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTabChangeGrafico = (event, newValue) => {
    setTabValueGrafico(newValue);
  };

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

  // Configuración del gráfico de usuarios
  const userChartOptions = {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '50%',
        distributed: true,
        dataLabels: { position: 'bottom' },
      },
    },
    colors: [
      '#8f2e2e',
      '#00E396',
      '#FEB019',
      '#FF4560',
      '#775DD0',
      '#3F51B5',
      '#546E7A',
      '#D7263D',
      '#02A9F4',
      '#66BB6A',
    ],
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      style: { colors: ['#fff'] },
      formatter: (val) => val,
      offsetX: 0,
    },
    stroke: { width: 1, colors: ['#fff'] },
    xaxis: { categories: topUsers.map((user) => user.usuario_subida) },
    yaxis: { labels: { show: true } },
    title: {
      text: 'Por registros Cargados',
      align: 'center',
      style: { fontSize: '16px' },
    },
    tooltip: {
      theme: 'dark',
      y: { title: { formatter: () => 'Registros:' } },
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
    chart: {
      type: 'bar',
      height: 350,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '50%',
        distributed: true,
        dataLabels: { position: 'bottom' },
      },
    },
    colors: [
      '#3F51B5',
      '#00E396',
      '#FEB019',
      '#FF4560',
      '#775DD0',
      '#8f2e2e',
      '#546E7A',
      '#D7263D',
      '#02A9F4',
      '#66BB6A',
    ],
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      style: { colors: ['#fff'] },
      formatter: (val) => val,
      offsetX: 0,
    },
    stroke: { width: 1, colors: ['#fff'] },
    xaxis: { categories: topCasas.map((casa) => casa.casa) },
    yaxis: { labels: { show: true } },
    title: {
      text: 'Por Casa',
      align: 'center',
      style: { fontSize: '16px' },
    },
    tooltip: {
      theme: 'dark',
      y: { title: { formatter: () => 'Registros:' } },
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
      <Box sx={{ p: 1, maxWidth: 'lg', mx: 'auto', width: '100%' }}>
        {/* Título */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 12, md: 12 }}>
            <Typography
              variant='h4'
              sx={{ color: '#8f2e2e', mb: 4, textAlign: 'center' }}
            >
              Reporte Casas
            </Typography>
          </Grid>
        </Grid>

        {/* Tarjetas centradas */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary'>
                  Total de Registros
                </Typography>
                {loading ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
                  >
                    <CircularProgress style={{ color: '#8f2e2e' }} />
                  </Box>
                ) : (
                  <Typography variant='h4'>
                    {totalUploads.toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/*  
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary'>
                  Usuarios Activos
                </Typography>
                {loading ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
                  >
                    <CircularProgress style={{ color: '#8f2e2e' }}/>
                  </Box>
                ) : (
                  <Typography variant='h4'>{usuariosActivos}</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          */}
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary'>
                  Casas Activas
                </Typography>
                {loading ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
                  >
                    <CircularProgress style={{ color: '#8f2e2e' }}/>
                  </Box>
                ) : (
                  <Typography variant='h4'>{casasActivas}</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
  {/*  
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary'>
                  Promedio por Usuario
                </Typography>
                {loading ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
                  >
                    <CircularProgress style={{ color: '#8f2e2e' }}/>
                  </Box>
                ) : (
                  <Typography variant='h4'>
                    {Math.round(averageUploads).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary'>
                  Promedio por Casa
                </Typography>
                {loading ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
                  >
                    <CircularProgress style={{ color: '#8f2e2e' }} />
                  </Box>
                ) : (
                  <Typography variant='h4'>
                    {Math.round(promedioPorCasa).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
 */}
        {/* Tabs para alternar entre diferentes tipos de gráficos */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabValueGrafico}
            onChange={handleTabChangeGrafico}
            centered
            sx={{
              '& .MuiTab-root': {
                // Estilo general de cada tab
                color: '#8f2e2e',
                fontWeight: 'bold',
              },
              '& .MuiTab-root.Mui-selected': {
                // Tab seleccionado
                color: '#8f2e2e',
              },
              '& .MuiTabs-indicator': {
                // Barrita inferior
                backgroundColor: '#8f2e2e',
              },
            }}
          >
            <Tab label='Registros por Casas' />
       {/*     <Tab label='Vista Grilla' /> solo borrar aqui y abajo si quieren el grafico*/} 
          </Tabs>
        </Box>
        {/* Contenido de las tabs */}


        {tabValueGrafico === 0 && (
          <Grid container spacing={1}>
            <Grid size={{ sm: 12, xs: 12, md: 12 }}>
              <Card>
                <CardContent>
                  {' '}
                  <GraficoCasas />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {tabValueGrafico === 1 && (
          <>
            <Grid container spacing={1}>
              <Grid size={{ sm: 12, xs: 12, md: 12 }}>
                <Card>
                  <CardContent>
                    <Typography variant='h6' gutterBottom>
                      Grafico Casas
                    </Typography>
                       {/*  <TreemapCasas /> sacar comentario para grafico */}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}

     

        {/* Tabs para alternar entre vista de usuarios y casas */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            centered
            sx={{
              '& .MuiTab-root': {
                // Estilo general de cada tab
                color: '#8f2e2e',
                fontWeight: 'bold',
              },
              '& .MuiTab-root.Mui-selected': {
                // Tab seleccionado
                color: '#8f2e2e',
              },
              '& .MuiTabs-indicator': {
                // Barrita inferior
                backgroundColor: '#8f2e2e',
              },
            }}
          >
            {' '}
            <Tab label='Resumen por Usuarios' />
            <Tab label='Resumen por Casa' />
          </Tabs>
        </Box>

        {/* Contenido de las tabs */}

        {tabValue === 0 && (
          <Grid container spacing={1}>
            <Grid size={{ sm: 12, xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Listado de Usuarios
                  </Typography>
                  <Box sx={{ height: 400, width: '100%' }}>
                    <ThemeProvider theme={theme}>
                      <DataGrid
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
                            labelRowsPerPage: 'Filas por página', // Aquí cambias "Rows per page"
                          },
                        }}
                        pageSizeOptions={[10, 20, 50]}
                        initialState={{
                          pagination: { paginationModel: { pageSize: 10 } },
                          sorting: {
                            sortModel: [{ field: 'registros', sort: 'desc' }],
                          },
                        }}
                      />
                    </ThemeProvider>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6, sm: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Top 10 Usuarios
                  </Typography>
                  {topUsers.length > 0 ? (
                    <ReactApexChart
                      options={userChartOptions}
                      series={userChartSeries}
                      type='bar'
                      height={388}
                      width='100%'
                    />
                  ) : (
                    <Typography variant='body1' align='center'>
                      No hay datos suficientes para mostrar el gráfico
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {tabValue === 1 && (
          <Grid container spacing={1}>
            <Grid size={{ sm: 12, xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Listado de Casas
                  </Typography>
                  <Box sx={{ height: 400, width: '100%' }}>
                    <ThemeProvider theme={theme}>
                      <DataGrid
                        rows={casaData}
                        columns={casaColumns}
                        loading={loading}
                        disableSelectionOnClick
                        density='compact'
                        pageSizeOptions={[10, 20, 50]}
                        initialState={{
                          pagination: { paginationModel: { pageSize: 10 } },
                          sorting: {
                            sortModel: [{ field: 'registros', sort: 'desc' }],
                          },
                        }}
                      />
                    </ThemeProvider>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6, sm: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Top 10 Casas
                  </Typography>
                  {topCasas.length > 0 ? (
                    <ReactApexChart
                      options={casaChartOptions}
                      series={casaChartSeries}
                      type='bar'
                      height={388}
                      width='100%'
                    />
                  ) : (
                    <Typography variant='body1' align='center'>
                      No hay datos suficientes para mostrar el gráfico
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </>
  );
}

export default ReporteUsuarios;
