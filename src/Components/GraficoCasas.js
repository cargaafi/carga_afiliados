import React, { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import axios from "axios";
import { Box, Typography } from "@mui/material";
import { API_URL } from "../Config/Config";

const GraficoCasas = () => {
  const [casas, setCasas] = useState([]);

  useEffect(() => {
    const fetchCasas = async () => {
      try {
        const response = await axios.get(`${API_URL}/getGraficoCasas`);
        setCasas(response.data.chartData);
      } catch (error) {
        console.error("Error al obtener datos de las casas:", error);
      }
    };
    fetchCasas();
  }, []);

  // Configuración de columnas
  const columns = [
    { field: "casa", headerName: "Casa", flex: 1 },
    { field: "registros", headerName: "Registros", flex: 1 },
  ];

  return (
    <Box
      sx={{
        height: 500,
        width: "100%",
        overflow: "auto",
        bgcolor: "#fff",
        p: 2,
        borderRadius: 2,
        boxShadow: 3,
      }}
    >
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        Registros por Casa
      </Typography>

      <DataGrid
        rows={casas.map((casa, index) => ({ id: index, ...casa }))}
        columns={columns}
        disableSelectionOnClick
        density="compact"
        localeText={{
          toolbarExport: "Exportar",
          toolbarDensity: "Densidad",
          toolbarColumns: "Columnas",
          footerRowSelected: (count) =>
            count !== 1 ? `${count} filas seleccionadas` : "1 fila seleccionada",
          footerTotalRows: "Total de filas:",
          MuiTablePagination: {
            labelRowsPerPage: "Filas por página", // Aquí cambias "Rows per page"
          },
        }}
      />
    </Box>
  );
};

export default GraficoCasas;
