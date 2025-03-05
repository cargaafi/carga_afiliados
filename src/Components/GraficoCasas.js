import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  useTheme,
  ThemeProvider,
} from '@mui/material';
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
    { field: 'casa', headerName: 'Casa', flex: 1 },
    { field: 'registros', headerName: 'Registros', flex: 1 },
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
        <Typography variant='h5' sx={{ mb: 2, fontWeight: 'bold' }}>
          Registros por Casa
        </Typography>

        <MainGrid
          rows={casas.map((casa, index) => ({ id: index, ...casa }))}
          columns={columns}
          fileNameVar='Casas_registradas'
          idField='casa'
          showActions={false}
          defaultPageSize={50} 
        />
      </Box>
    </ThemeProvider>
  );
};

export default GraficoCasas;
