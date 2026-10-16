import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { SelectorModulo, SLATE } from '../Components/SelectorModulo';
import DashboardModulo from '../Components/DashboardModulo';

function Inicio() {
  const [modulo, setModulo] = useState('RD');

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 1400, mx: 'auto', width: '100%', minWidth: 0 }}>
      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 27, fontWeight: 700, color: SLATE, m: 0 }}>
          Tablero Informativo
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5, mb: 2 }}>
          Avance de asignación por módulo
        </Typography>
        <SelectorModulo valor={modulo} onChange={setModulo} />
      </Box>

      {modulo === 'RD' && <DashboardModulo endpoint='/rdResumen' />}
      {modulo === 'RG' && (
        <DashboardModulo
          endpoint='/rgResumen'
          ubicacion={(u) => `sección ${u.seccion_electoral_ubic} · casilla ${u.casilla}`}
        />
      )}
      {modulo === 'RC' && (
        <DashboardModulo
          endpoint='/rcResumen'
          ubicacion={(u) => `sección ${u.seccion_electoral_ubic} · casilla ${u.casilla} · ${u.cargo || ''}`}
        />
      )}
    </Box>
  );
}

export default Inicio;
