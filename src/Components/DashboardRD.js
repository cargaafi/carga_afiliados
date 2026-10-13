import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, CircularProgress, Chip } from '@mui/material';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { SLATE } from './SelectorModulo';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';

const cardSx = {
  borderRadius: 3,
  height: '100%',
  boxShadow: '0 12px 30px -18px rgba(69,90,100,0.28), 0 2px 12px rgba(17,17,17,0.06)',
};

const PALETA = ['#37474F', '#455A64', '#546E7A', '#607D8B', '#78909C', '#90A4AE', '#A3B5BE', '#B0BEC5'];

function Kpi({ icono, label, valor, pie }) {
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: '16px 18px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: '9px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              backgroundColor: 'rgba(69,90,100,0.14)', color: SLATE,
            }}
          >
            {icono}
          </Box>
        </Box>
        <Typography sx={{ fontSize: 25, fontWeight: 700, lineHeight: 1.1 }}>{valor}</Typography>
        {pie && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{pie}</Typography>}
      </CardContent>
    </Card>
  );
}

function Barras({ datos, claveNombre, claveValor, maximo, vacio }) {
  if (!datos || !datos.length) {
    return <Typography sx={{ fontSize: 12.5, color: 'text.secondary', textAlign: 'center', py: 4 }}>{vacio}</Typography>;
  }
  const max = maximo || Math.max(...datos.map((d) => Number(d[claveValor]) || 0), 1);
  return (
    // alto fijo con scroll propio: con las 32 entidades cargadas esto medía
    // casi 1000px y estiraba todo el tablero
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.2,
        mt: 1,
        maxHeight: 290,
        overflowY: 'auto',
        pr: 0.5,
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(69,90,100,0.25)', borderRadius: 3 },
      }}
    >
      {datos.map((d, i) => {
        const v = Number(d[claveValor]) || 0;
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              sx={{
                width: 108, flexShrink: 0, fontSize: 11.5, color: 'text.secondary',
                textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              title={String(d[claveNombre])}
            >
              {d[claveNombre]}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0, height: 20, borderRadius: '5px', backgroundColor: 'rgba(69,90,100,0.08)', overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${Math.max((v / max) * 100, 6)}%`, height: '100%', borderRadius: '5px',
                  backgroundColor: PALETA[i % PALETA.length], display: 'flex', alignItems: 'center',
                  pl: 1, color: '#fff', fontSize: 11, fontWeight: 700,
                }}
              >
                {v}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default function DashboardRD() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/rdResumen`)
      .then((r) => setDatos(r.data))
      .catch((e) => setError(e.response?.data?.message || 'No se pudo cargar el reporte'))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: SLATE }} />
      </Box>
    );
  }
  if (error) {
    return <Typography sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>{error}</Typography>;
  }

  const d = datos;
  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      {/* avance: la métrica que importa */}
      <Card sx={{ ...cardSx, mb: 2 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>
                Avance de asignación
              </Typography>
              <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>
                {d.cargados} <Typography component='span' sx={{ fontSize: 17, color: 'text.secondary', fontWeight: 500 }}>de {d.totalDistritos} distritos</Typography>
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 34, fontWeight: 700, color: SLATE }}>{d.avance}%</Typography>
          </Box>
          <LinearProgress
            variant='determinate'
            value={Math.min(d.avance, 100)}
            sx={{
              mt: 2, height: 10, borderRadius: 5,
              backgroundColor: 'rgba(69,90,100,0.12)',
              '& .MuiLinearProgress-bar': { borderRadius: 5, backgroundColor: SLATE },
            }}
          />
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
            Faltan {d.faltantes} distritos por asignar
          </Typography>
        </CardContent>
      </Card>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 2, mb: 2 }}>
        <Kpi icono={<PersonOutlineOutlinedIcon sx={{ fontSize: 18 }} />} label='Responsables cargados' valor={d.cargados} />
        <Kpi icono={<HomeWorkOutlinedIcon sx={{ fontSize: 18 }} />} label='Casas que ya cargaron' valor={d.casas} pie='de 56' />
        <Kpi icono={<MapOutlinedIcon sx={{ fontSize: 18 }} />} label='Entidades con avance' valor={d.entidades} pie='de 32' />
        <Kpi icono={<BadgeOutlinedIcon sx={{ fontSize: 18 }} />} label='Con INE vencido' valor={d.ineVencido} pie='requieren renovación' />
      </Box>

      {/* detalle */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 2, mb: 2 }}>
        <Card sx={cardSx}>
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Avance por entidad</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>distritos asignados</Typography>
            </Box>
            <Barras datos={d.porEntidad} claveNombre='estado' claveValor='cargados' vacio='Sin datos todavía' />
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Casas más activas</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>top 10</Typography>
            </Box>
            <Barras
              datos={(d.porCasa || []).map((c) => ({ ...c, etiqueta: c.entidad || `Casa ${c.casa}` }))}
              claveNombre='etiqueta'
              claveValor='cargados'
              vacio='Ninguna casa cargó todavía'
            />
          </CardContent>
        </Card>
      </Box>

      {/* calidad + actividad */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 2 }}>
        <Card sx={cardSx}>
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, mb: 1.5 }}>Calidad de los datos</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                ['Sin teléfono', d.sinTelefono],
                ['Sin correo', d.sinCorreo],
                ['INE vencido', d.ineVencido],
              ].map(([label, n]) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{label}</Typography>
                  <Chip
                    size='small'
                    label={n}
                    sx={{
                      height: 22, fontSize: 11.5, fontWeight: 700,
                      backgroundColor: n > 0 ? 'rgba(239,108,0,0.14)' : 'rgba(69,90,100,0.1)',
                      color: n > 0 ? '#ef6c00' : 'text.secondary',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent sx={{ p: '14px 16px !important' }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, mb: 1.5 }}>Últimas cargas</Typography>
            {d.ultimas && d.ultimas.length ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {d.ultimas.map((u, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.estado} · distrito {u.distrito_federal} — {[u.nombre, u.apellido_paterno].filter(Boolean).join(' ')}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>
                      {u.usuario_subida}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 2 }}>Todavía no hay cargas</Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
