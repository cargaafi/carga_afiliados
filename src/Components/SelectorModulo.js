import React from 'react';
import { Box, Typography } from '@mui/material';

export const SLATE = '#455A64';
export const SLATE_OSCURO = '#37474F';

export const MODULOS = [
  { id: 'RD', titulo: 'RD', detalle: 'Responsables de Distrito' },
  { id: 'RG', titulo: 'RG', detalle: 'Responsables Generales' },
  { id: 'RC', titulo: 'RC', detalle: 'Responsables de Casilla' },
];

/**
 * Control segmentado: una pastilla con las tres opciones y la activa en blanco.
 * Se adapta a pantallas chicas apilando en columna.
 */
export function SelectorModulo({ valor, onChange, conteos = {} }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 0.5,
        p: 0.5,
        borderRadius: '14px',
        backgroundColor: 'rgba(69,90,100,0.08)',
        width: 'fit-content',
        maxWidth: '100%',
        mx: 'auto',
      }}
    >
      {MODULOS.map((m) => {
        const activo = valor === m.id;
        const n = conteos[m.id];
        return (
          <Box
            key={m.id}
            onClick={() => onChange(m.id)}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange(m.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2.2,
              py: 1,
              borderRadius: '11px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color .15s, box-shadow .15s',
              backgroundColor: activo ? 'background.paper' : 'transparent',
              boxShadow: activo ? '0 2px 8px rgba(17,17,17,0.12)' : 'none',
              '&:hover': { backgroundColor: activo ? 'background.paper' : 'rgba(69,90,100,0.06)' },
            }}
          >
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 700,
                color: activo ? SLATE : 'text.secondary',
                lineHeight: 1.2,
              }}
            >
              {m.titulo}
            </Typography>
            <Typography
              sx={{
                fontSize: 12,
                color: 'text.secondary',
                display: { xs: 'none', md: 'block' },
              }}
            >
              {m.detalle}
            </Typography>
            {n !== undefined && (
              <Box
                sx={{
                  minWidth: 22,
                  px: 0.7,
                  py: '1px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: activo ? '#fff' : 'text.secondary',
                  backgroundColor: activo ? SLATE : 'rgba(69,90,100,0.14)',
                }}
              >
                {n}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Pantalla para los módulos que todavía no existen. */
export function EstadoVacio({ modulo, accion }) {
  const m = MODULOS.find((x) => x.id === modulo);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: 10,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(69,90,100,0.1)',
          color: SLATE,
        }}
      >
        <svg width='26' height='26' viewBox='0 0 24 24' fill='none'>
          <path d='M4 7h16M4 12h16M4 17h9' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        </svg>
      </Box>
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
        Todavía no hay datos de {m ? m.detalle : modulo}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', maxWidth: 420 }}>
        {accion || `Cuando se habilite la carga de ${modulo}, la información va a aparecer acá.`}
      </Typography>
    </Box>
  );
}
