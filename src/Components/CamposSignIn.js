import React, { useState } from 'react';
import { Box, TextField, Button, Typography, CircularProgress } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { useAuth } from '../Components/AuthContext';

const MAROON = '#455A64';
const MAROON_HOVER = '#37474F';
const MAROON_DEEP = '#263238';
const BG = '#F9F9FE';

const keyframesCss = `
  @keyframes loginFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .login-a0 { animation: loginFadeUp .5s ease both; }
  .login-a1 { animation: loginFadeUp .5s ease .08s both; }
  .login-a2 { animation: loginFadeUp .5s ease .16s both; }
  .login-a3 { animation: loginFadeUp .5s ease .24s both; }
  .login-a4 { animation: loginFadeUp .5s ease .32s both; }
  .login-a5 { animation: loginFadeUp .5s ease .4s both; }
`;

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    '& fieldset': { borderColor: '#dfdfe3' },
    '&:hover fieldset': { borderColor: '#c9c9ce' },
    '&.Mui-focused fieldset': {
      borderColor: MAROON,
      borderWidth: '1px',
      boxShadow: '0 0 0 3px rgba(69, 90, 100,0.12)',
    },
  },
};

export default function SlotPropsSignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/loginUsers`, {
        username,
        password,
      });

      if (response.data.code === 'USR_INCOR') {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Contraseña incorrecta',
          confirmButtonColor: MAROON,
          confirmButtonText: 'Aceptar',
        });
      } else if (response.data.code === 'USR_NOT_EXIST') {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El usuario no existe',
          confirmButtonColor: MAROON,
          confirmButtonText: 'Aceptar',
        });
      } else {
        localStorage.setItem('jwtToken', response.data.token);
        // se guardan para que la sesión sobreviva al F5: sin el rol la
        // pantalla no sabe si mostrar las opciones de administrador
        localStorage.setItem('usuario', username);
        localStorage.setItem('rol', response.data.role || '');
        axios.defaults.headers.common['Authorization'] =
          'Bearer ' + response.data.token;
        login({
          username: username,
          role: response.data.role,
        });
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Error de conexión',
        confirmButtonColor: MAROON,
        confirmButtonText: 'Aceptar',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{keyframesCss}</style>
      <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flex: '0 0 44%',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            p: 6,
            color: '#ffffff',
            overflow: 'hidden',
            background: `linear-gradient(160deg, #546E7A 0%, ${MAROON_DEEP} 100%)`,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              opacity: 0.6,
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <Box className='login-a0'>
              <svg width='120' height='120' viewBox='0 0 96 96' fill='none'>
                <path
                  d='M20 8h32l24 24v48a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z'
                  fill='rgba(255,255,255,0.12)'
                  stroke='#ffffff'
                  strokeWidth='2.5'
                />
                <path
                  d='M52 8v20a4 4 0 0 0 4 4h20'
                  fill='none'
                  stroke='#ffffff'
                  strokeWidth='2'
                  strokeOpacity='0.55'
                />
                <path
                  d='M48 36v26'
                  stroke='#ffffff'
                  strokeWidth='7'
                  strokeLinecap='round'
                />
                <path
                  d='M36 48l12-12 12 12'
                  stroke='#ffffff'
                  strokeWidth='7'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  fill='none'
                />
              </svg>
            </Box>
            <Typography
              className='login-a1'
              sx={{ fontSize: 26, fontWeight: 600, mt: 2.5, letterSpacing: '0.2px' }}
            >
              Carga de Representantes
            </Typography>
            <Typography
              className='login-a2'
              sx={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.72)',
                mt: 1,
                maxWidth: 280,
                lineHeight: 1.5,
              }}
            >
              Sistema interno de registro
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            flex: '1 1 56%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 3, sm: 6 },
            backgroundColor: BG,
          }}
        >
          <Box
            component='form'
            onSubmit={handleSubmit}
            sx={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              p: { xs: 4, sm: '44px 40px 40px' },
              boxShadow:
                '0 24px 60px -24px rgba(69, 90, 100,0.28), 0 2px 12px rgba(17,17,17,0.05)',
            }}
          >
            <Typography
              className='login-a0'
              component='h2'
              sx={{
                fontSize: '24px',
                lineHeight: 1.3,
                fontWeight: 600,
                color: '#333333',
                textAlign: 'center',
                m: 0,
              }}
            >
              Iniciar sesión
            </Typography>
            <Box
              className='login-a1'
              sx={{
                width: 160,
                height: 3,
                borderRadius: '2px',
                backgroundColor: MAROON,
                mx: 'auto',
                mt: 1.5,
              }}
            />
            <Typography
              className='login-a2'
              sx={{
                fontSize: 14,
                color: '#787878',
                textAlign: 'center',
                mt: 1.75,
                mb: 4,
              }}
            >
              Ingresa tus credenciales para continuar
            </Typography>

            <Box className='login-a3' sx={{ mb: 2.5 }}>
              <Typography
                component='label'
                sx={{
                  display: 'block',
                  fontSize: 13,
                  color: '#5a5a5a',
                  mb: 0.75,
                  fontWeight: 500,
                }}
              >
                Usuario
              </Typography>
              <TextField
                fullWidth
                size='small'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder='usuario@dominio.com'
                sx={fieldSx}
              />
            </Box>

            <Box className='login-a4' sx={{ mb: 2.5 }}>
              <Typography
                component='label'
                sx={{
                  display: 'block',
                  fontSize: 13,
                  color: '#5a5a5a',
                  mb: 0.75,
                  fontWeight: 500,
                }}
              >
                Contraseña
              </Typography>
              <TextField
                fullWidth
                size='small'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='********'
                sx={fieldSx}
              />
            </Box>

            <Button
              type='submit'
              fullWidth
              disabled={isLoading}
              variant='contained'
              disableElevation
              className='login-a5'
              endIcon={!isLoading ? <ArrowForwardIcon /> : null}
              sx={{
                mt: 1.5,
                py: 1.4,
                borderRadius: '10px',
                backgroundColor: MAROON,
                color: '#ffffff',
                fontWeight: 600,
                letterSpacing: '0.3px',
                '&:hover': { backgroundColor: MAROON_HOVER },
              }}
            >
              {isLoading ? (
                <CircularProgress size={22} sx={{ color: '#ffffff' }} />
              ) : (
                'Entrar'
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export { SlotPropsSignIn };
