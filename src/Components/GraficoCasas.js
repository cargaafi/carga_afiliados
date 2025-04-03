import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, useTheme, ThemeProvider } from '@mui/material';
import { API_URL } from '../Config/Config';
import MainGrid from '../Grids/MainGrid';

const GraficoCasas = () => {
  const [casas, setCasas] = useState([]);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  useEffect(() => {
    const fetchCasas = async () => {
      try {
        const response = await axios.get(`${API_URL}/getGraficoCasas`);
        setCasas(response.data.chartData);
      } catch (error) {
        console.error('Error al obtener datos de las casas:', error);
      }
    };
    fetchCasas();
  }, []);

  const columns = [
    {
      field: 'casa',
      headerName: 'Casa',
      flex: 1,
      headerAlign: 'center',
      align: 'center',
    },
    {
      field: 'procesadas',
      headerName: 'Registros en Excel',
      flex: 1,
      headerAlign: 'center',
      align: 'center',
    },
    {
      field: 'total',
      headerName: 'Registros Cargados',
      flex: 1,
      headerAlign: 'center',
      align: 'center',
    },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          height: 500,
          width: '100%',
          overflow: 'auto',
          bgcolor: isDarkMode ? 'background.paper' : '#fff',
          p: 2,
          borderRadius: 2,
          boxShadow: 3,
        }}
      >
        <MainGrid
          rows={casas.map((casa, index) => ({ id: index, ...casa }))}
          columns={columns}
          fileNameVar='Registros Casas'
          idField='casa'
          showActions={false}
          defaultPageSize={50}
        />
      </Box>
    </ThemeProvider>
  );
};

export default GraficoCasas;
