import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { SelectorModulo, SLATE } from '../Components/SelectorModulo';
import GrillaRD from '../Components/GrillaRD';
import GrillaRG from '../Components/GrillaRG';
import GrillaRC from '../Components/GrillaRC';

function PantallaAfi() {
  const [modulo, setModulo] = useState('RD');

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 1400, mx: 'auto', width: '100%', minWidth: 0 }}>
      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 27, fontWeight: 700, color: SLATE, m: 0 }}>
          Responsables Cargados
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5, mb: 2 }}>
          Listado de lo Cargado en el sistema.
        </Typography>
        <SelectorModulo valor={modulo} onChange={setModulo} />
      </Box>

      {modulo === 'RD' && <GrillaRD />}
      {modulo === 'RG' && <GrillaRG />}
      {modulo === 'RC' && <GrillaRC />}
    </Box>
  );
}

export default PantallaAfi;
