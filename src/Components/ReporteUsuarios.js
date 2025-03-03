import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Tabs, Tab } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ReactApexChart from 'react-apexcharts';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { useAuth } from '../Components/AuthContext';
import Swal from 'sweetalert2';
import Grid from '@mui/material/Grid2';

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
  const { user } = useAuth();

  // Función que hace la llamada única al backend
  const getReporteCompleto = async () => {
    try {
      const response = await axios.get(`${API_URL}/getReporteCompleto`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
        },
      });
      const { estadisticas, topUsers, allUsers, casaStats, topCasas } = response.data;
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

  // Definición de columnas para el DataGrid de Usuarios
  const userColumns = [
    { field: 'usuario_subida', headerName: 'Usuario', width: 200 },
    {
      field: 'registros',
      headerName: 'Registros cargados',
      width: 150,
      type: 'number',
      align: 'right',
    },
    {
      field: 'ultima_fecha',
      headerName: 'Última carga',
      width: 180,
      valueGetter: (params) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleString('es-MX', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      },
    },
  ];

  // Definición de columnas para el DataGrid de Casas
  const casaColumns = [
    { field: 'casa', headerName: 'Casa', width: 200 },
    {
      field: 'registros',
      headerName: 'Registros',
      width: 150,
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
      <Box sx={{ p: 3, maxWidth: 'lg', mx: 'auto', width: '100%' }}>
        {/* Título */}
        <Grid container spacing={2} sx={{ mb: 4 }} >
          <Grid size={{ xs: 8, sm: 12, md: 12 }}>
            <Typography
              variant='h4'
              sx={{ color: '#8f2e2e', mb: 4, textAlign: 'center' }}
            >
              Reporte de Actividad de Usuarios y Casas
            </Typography>
          </Grid>
        </Grid>
        
        {/* Tarjetas centradas */}
        <Grid container spacing={2} sx={{ mb: 4 }} >
          <Grid size={{ xs: 8, sm: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary' >
                  Total de Registros
                </Typography>
                <Typography variant='h4' >
                  {totalUploads.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 8, sm: 6, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary' >
                  Usuarios Activos
                </Typography>
                <Typography variant='h4'>
                  {usuariosActivos}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 8, sm: 6, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary' >
                  Casas Activas
                </Typography>
                <Typography variant='h4'>
                  {casasActivas}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 4 }} >
          <Grid size={{ xs: 8, sm: 6, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary' >
                  Promedio por Usuario
                </Typography>
                <Typography variant='h4' >
                  {Math.round(averageUploads).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 8, sm: 6, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' color='text.secondary' >
                  Promedio por Casa
                </Typography>
                <Typography variant='h4' >
                  {Math.round(promedioPorCasa).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs para alternar entre vista de usuarios y casas */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange} centered>
            <Tab label="Reporte por Usuarios" />
            <Tab label="Reporte por Casa" />
          </Tabs>
        </Box>

        {/* Contenido de las tabs */}
        {tabValue === 0 && (
          <Grid container spacing={2}>
            <Grid size={{ sm: 4, xs: 8, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Listado de Usuarios
                  </Typography>
                  <Box sx={{ height: 400, width: '100%' }}>
                    <DataGrid
                      rows={userData}
                      columns={userColumns}
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
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 8, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Top 10 Usuarios por Registros Cargados
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
          <Grid container spacing={2}>
            <Grid size={{ sm: 4, xs: 8, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Listado de Casas
                  </Typography>
                  <Box sx={{ height: 400, width: '100%' }}>
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
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 8, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Top 10 Casas por Registros
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