import React, { useState, useEffect } from 'react';
import MainGrid from '../Grids/MainGrid';
import { mainColumns } from '../Grids/ColumnsGrids';
import Swal from 'sweetalert2';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { useAuth } from '../Components/AuthContext';
import { Box, Typography, Button } from '@mui/material';
import Grid from '@mui/material/Grid2';

function GridAfiliados() {
  const [carga, setCarga] = useState([]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Estado para manejar la paginación
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 20, // Cantidad de registros por página
  });

  const getCargaData__ = async (page = 0, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/getAfiliados`, {
        params: { usuario: user.username, page: page + 1, limit: pageSize }, // Paginación
      });
      setCarga(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      console.error("Error al obtener datos:", err);
      Swal.fire('Ooops', 'Unable to get data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Un SOLO useEffect para manejar los cambios de paginación
  useEffect(() => {
    getCargaData__(paginationModel.page, paginationModel.pageSize);
  }, [paginationModel.page, paginationModel.pageSize]);


  // Función para editar un campo de un registro
  const handleEditField = async (id, field, newValue) => {
    if (!newValue || newValue === '') {
      newValue = 'N/A'; // Valor predeterminado si viene vacío
    }
    try {
      await axios.put(`${API_URL}/editField`, {
        id,
        field,
        newValue,
      });
      // Actualiza el estado reemplazando el campo modificado
      setCarga((prevCarga) =>
        prevCarga.map((item) =>
          item.clave_elector === id ? { ...item, [field]: newValue } : item
        )
      );
      Swal.fire('Good job!', `${field} updated successfully!`, 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error!', `The ${field} could not be updated`, 'error');
    }
  };

  // Función para eliminar un registro (usando clave_elector como id)
  const handleDeleteRecord = async (id) => {
    try {
      await axios.delete(`${API_URL}/deleteAfiliado`, {
        data: { id },
      });
      setCarga((prevCarga) =>
        prevCarga.filter((item) => item.clave_elector !== id)
      );
      Swal.fire('Deleted!', 'The record has been deleted', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error!', 'The record could not be deleted', 'error');
    }
  };

  const rows = carga.map((row) => ({
    id: row.clave_elector,
    ...row,
  }));

return (
  <Box
    sx={{
      width: '99%',
      p:2.2
    }}
  >
    <Grid container spacing={1}>
      <Grid size={{ xs: 2.5, sm: 4, md: 6, lg: 10 }}>
        <Typography
          variant='h4'
          sx={{ color: '#8f2e2e', mb: 1, textAlign: 'center' }}
        >
          Registros de Afiliados
        </Typography>
      </Grid>
    </Grid>
    <Grid container spacing={0} size={50}>
      <Grid size={{ xs: 2.5, sm: 4.5, md: 6, lg: 10 }}>
        <MainGrid
          rows={rows}
          columns={mainColumns()}
          fileNameVar='Afiliados_cargados'
          showActions={false}
          loading={loading}
          paginationMode='server'
          rowCount={total}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[20, 50, 100]} 
          keepNonExistentRowsSelected
        />
      </Grid>
    </Grid>
  </Box>
);
}

export default GridAfiliados;