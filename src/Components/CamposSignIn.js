import React, { useState } from 'react';
import { Button, Box, CircularProgress } from '@mui/material';
import { AppProvider } from '@toolpad/core/AppProvider';
import { SignInPage } from '@toolpad/core/SignInPage';
import { createTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import { API_URL } from '../Config/Config';
import { useAuth } from '../Components/AuthContext';
import logo from '../Components/img/logoCarga.png';
import LoginIcon from '@mui/icons-material/Login';

function CustomButton({ isLoading }) {
  return (
    <Button
      type='submit'
      variant='contained'
      size='small'
      disableElevation
      fullWidth
      disabled={isLoading}
      sx={{
        my: 5,
        color: '#FFFFFF',
        borderColor: '#828b8ed6',
        backgroundColor: '#8f2e2e', // Color de fondo del botón  8f2e2e 828b8ed6
        '&:hover': {
          backgroundColor: '#6b3232c7',
          borderColor: '#FFB74D',
          color: '#ffffff',
        },
        '&:active': {
          backgroundColor: '#6b3232c7',
          borderColor: '#FFCC80',
        },
      }}
    >
      {isLoading ? (
        <CircularProgress size={24} sx={{ color: '#8f2e2e' }} /> // Spinner en blanco
      ) : (
        <>
          Entrar
          <LoginIcon sx={{ ml: 0.5 }} />
        </>
      )}
    </Button>
  );
}

const BRANDING = {
  logo: (
    <img src={logo} alt='logo login' style={{ height: 150, pt: 5 }} />
  ),
  title: 'logo',
};

export default function SlotPropsSignIn() {
  const [isLoading, setIsLoading] = useState(false);

  const theme = createTheme({
    components: {
      MuiInput: {
        styleOverrides: {
          underline: {
            '&:before': {
              borderBottomColor: '#787878', // Color de la línea antes de enfoque
            },
            '&:hover:not(.Mui-disabled):before': {
              borderBottomColor: '#8f2e2e', // Color de la línea al hacer hover
            },
            '&:after': {
              borderBottomColor: '#8f2e2e', // Color de la línea cuando está enfocado (gris oscuro)
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: '#787878', // Color inicial del label
            '&.Mui-focused': {
              color: '#8f2e2e', // Color del label cuando está enfocado
            },
          },
        },
      },
    },
  });

  const navigate = useNavigate();
  const { login } = useAuth();

  // Lógica de inicio de sesión
  const handleSignIn = async (providers, formData) => {
    setIsLoading(true);
    try {
      const username = formData.get('email');
      const password = formData.get('password');
      const response = await axios.post(`${API_URL}/loginUsers`, {
        username,
        password,
      });

      if (response.data.code === 'USR_INCOR') {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Contraseña incorrecta',
          confirmButtonColor: '#8f2e2e', // Aquí tu color personalizado
          confirmButtonText: 'Aceptar',
        });
      } else if (response.data.code === 'USR_NOT_EXIST') {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El usuario no existe',
          confirmButtonColor: '#8f2e2e', // Aquí tu color personalizado
          confirmButtonText: 'Aceptar',
        });
      } else {
        // Almacenar token en localStorage
        localStorage.setItem('jwtToken', response.data.token);
        axios.defaults.headers.common['Authorization'] =
          'Bearer ' + response.data.token;
        // Establecer sesión real con el response
        login({
          username: username,
         // fullName: response.data.nombre_completo,
          role: response.data.role,
        });
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Error de conexión',  confirmButtonColor: '#8f2e2e', // Aquí tu color personalizado
        confirmButtonText: 'Aceptar', }); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppProvider theme={theme} branding={BRANDING}>
      {/* Contenedor Box para agregar el margen superior */}
      <Box sx={{ pt: 8 }}>
        {' '}
        {/* Ajusta el valor de `pt` según tus necesidades */}
        <SignInPage
          signIn={handleSignIn}
          slotProps={{
            emailField: { variant: 'standard', label: 'Usuario' },
            passwordField: { variant: 'standard', label: 'Contraseña' },
            forgotPasswordLink: null,
          }}
          slots={{
            submitButton: (props) => (
              <CustomButton {...props} isLoading={isLoading} />
            ), // Pasa `isLoading` al botón
          }}
          providers={[{ id: 'credentials', name: 'Email and Password' }]}
        />
      </Box>
    </AppProvider>
  );
}

export { SlotPropsSignIn };
