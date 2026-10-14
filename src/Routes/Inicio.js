import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { SelectorModulo, EstadoVacio, SLATE } from '../Components/SelectorModulo';
import DashboardRD from '../Components/DashboardRD';

function Inicio() {
  const [modulo, setModulo] = useState('RD');

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 1400, mx: 'auto', width: '100%', minWidth: 0 }}>
      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 27, fontWeight: 700, color: SLATE, m: 0 }}>
          Tablero de Responsables
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5, mb: 2 }}>
          Avance de asignación por módulo
        </Typography>
        <SelectorModulo valor={modulo} onChange={setModulo} />
      </Box>

      {modulo === 'RD' && <DashboardRD />}
      {modulo === 'RG' && (
        <EstadoVacio
          modulo='RG'
          accion='La carga de Responsables Generales todavía no está habilitada. Cuando lo esté, verás aquí el mismo avance que en RD.'
        />
      )}
      {modulo === 'RC' && (
        <EstadoVacio
          modulo='RC'
          accion='La carga de Responsables de Casilla todavía no está habilitada. Cuando lo esté, verás aquí el mismo avance que en RD.'
        />
      )}
    </Box>
  );
}

export default Inicio;
