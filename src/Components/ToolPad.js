import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { createTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import {
  AppProvider,
  AuthenticationContext,
  SessionContext,
} from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { useDemoRouter } from '@toolpad/core/internal';
import Inicio from '../Routes/Inicio';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import '../CSS/App.css';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import UserConfig from '../Routes/UserConfig';
//import CustomMenu from './CustomMenu';
import { MenuItem, Stack, Divider, ListItemIcon, Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  AccountPreview,
  AccountPopoverFooter,
} from '@toolpad/core/Account';
import CargaExcel from '../Routes/CargaExcel';
import CargaRD from '../Routes/CargaRD';
import CargaRG from '../Routes/CargaRG';
import GridViewIcon from '@mui/icons-material/GridView';
import PantallaAfi from '../Routes/PantallaAfi';
const customTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'data-toolpad-color-scheme',
  },
  colorSchemes: {
    light: {
      palette: {
        background: {
          default: '#F9F9FE',
          paper: '#F9F9FE',
        },
        action: {
          hover: 'rgba(69, 90, 100, 0.5)', // Hover en naranja claro. Menu Logout
          focus: 'rgba(69, 90, 100, 0.5)',
          selected: '#D3D3D3', // Gris claro en selected (light theme)
        },
      },
    },
    dark: {
      palette: {
        background: {
          default: '#14171acc',
          paper: '#14171acc',
        },
        action: {
          hover: 'rgba(69, 90, 100, 0.5))',
          focus: 'rgba(69, 90, 100, 0.5)',
          selected: '#2C2C2C', // Gris oscuro en selected (dark theme)
        },
      },
    },
  },
  components: {
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#828b8e', // Color inicial en gris claro
          '&.Mui-selected': {
            color: '#828b8e', // Gris claro en el ícono cuando está seleccionado
          },
          '&:hover': {
            color: 'grey', // Hover gris claro para light y dark
            backgroundColor: 'transparent',
          },
          // Cambiar el color del ícono cuando se activa el modo oscuro
          '& svg[data-testid="DarkModeIcon"]': {
            color: '#828b8e', // Gris claro para el ícono de modo oscuro en tema claro
          },
          '& svg[data-testid="DarkModeIcon"]:hover': {
            color: '#455A64 ', // Hover naranja para el icono de modo oscuro
          },
          '& svg[data-testid="LightModeIcon"]': {
            color: '#FFFFFF', // Blanco para el ícono de modo claro en tema oscuro
          },
          '& svg[data-testid="LightModeIcon"]:hover': {
            color: '#455A64 ', // Hover gris claro para el ícono en tema oscuro
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: '#D3D3D3', // Fondo gris claro cuando está seleccionado en light
            color: '#455A64', // Naranja claro en texto cuando está seleccionado
            '& .MuiListItemIcon-root .MuiSvgIcon-root': {
              color: '#455A64', // Cambia color del ícono SVG cuando está seleccionado
            },
            '& .MuiListItemText-root .MuiTypography-root': {
              color: 'grey', // Cambia color del texto (Typography) cuando está seleccionado
            },
            '&:hover': {
              backgroundColor: 'rgba(69, 90, 100, 0.5)', // Fondo gris oscuro en hover cuando está seleccionado
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(221, 221, 221, 0.97)', // Fondo en hover cuando no está seleccionado
            '& .MuiListItemIcon-root .MuiSvgIcon-root': {
              color: '#455A64', // Color mor claro en íconos en hover
            },
            '& .MuiListItemText-root .MuiTypography-root': {
              color: '#455A64', // Color mor claro en texto en hover
            },
          },
        },
      },
    },
  },
});
// Con la barra colapsada solo se ven los iconos, y RD y RG usaban el mismo
// icono de subida: eran indistinguibles. Estas siglas se leen de una.
function IconoSigla({ children }) {
  return (
    <Box
      sx={{
        width: 24,
        height: 24,
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1.5px solid',
        borderColor: 'currentColor',
        color: 'inherit',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.3px',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

function CustomMenu({ router }) {
  // El SignOutButton de Toolpad se dibuja en color "primary" y con un filtro
  // de opacidad: sobre el fondo oscuro quedaba apagado hasta el hover. Usamos
  // un Button propio, que llama al mismo signOut del contexto.
  const authentication = React.useContext(AuthenticationContext);
  const handleConfigClick = () => {
    router.navigate('/userConfig');
  };

  return (
    <Stack direction='column'>
      <AccountPreview variant='expanded' />
      <Divider />
      <MenuItem onClick={handleConfigClick}>
        <ListItemIcon>
          <SettingsIcon fontSize='small' />
        </ListItemIcon>
        Configuración
      </MenuItem>
      <Divider />
      <AccountPopoverFooter>
        <Button
          variant='outlined'
          size='small'
          fullWidth
          disableElevation
          startIcon={<LogoutIcon />}
          onClick={() => authentication?.signOut?.()}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            // text.primary y divider compilan a variables CSS que cambian
            // solas con el tema: blanco en oscuro, gris oscuro en claro. Con
            // un selector [data-toolpad-color-scheme] la regla perdia por
            // especificidad contra el propio estilo base del boton.
            color: 'text.primary',
            borderColor: 'divider',
            '&:hover': {
              color: 'text.primary',
              borderColor: 'text.primary',
              backgroundColor: 'rgba(128,128,128,0.16)',
            },
          }}
        >
          Cerrar sesión
        </Button>
      </AccountPopoverFooter>
    </Stack>
  );
}
function DemoPageContent({ pathname }) {
  return (
    <Box
      sx={{
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        // minWidth 0: sin esto el ancho minimo de las grillas estira el layout
        // y las paginas se desbordan del viewport
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {pathname === '/dashboard' && (
        <Inicio /> //  <Typography variant='h4'>Welcome to the Dashboard</Typography>
      )}
      {pathname === '/inicio' && <Inicio />}
      {pathname === '/' && <Inicio />}
      {pathname === '/PantallaAfi' && <PantallaAfi />}
      {pathname === '/CargaRD' && <CargaRD />}
      {pathname === '/CargaRG' && <CargaRG />}
      {/* Carga de afiliados: oculta del menu, el codigo queda para reactivarla */}
      {pathname === '/CargaExcel' && <CargaExcel />}
      {pathname === '/userConfig' && <UserConfig />}
    </Box>
  );
}

DemoPageContent.propTypes = {
  navigate: PropTypes.func.isRequired,
  pathname: PropTypes.string.isRequired,
};

function DashboardLayoutPattern() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const router = useDemoRouter('/dashboard');

  const [session, setSession] = useState(null);


  
  const Datasession = useMemo(() => {
    if (!user) return null;
    
    // Calculas aquí las fracciones del string
    const nombreSinUltimo = user.username.slice(0, -1);
    const ultimoCaracter = user.username.slice(-1);
  
    return {
      user: {
        name: user.username,
        email: 'Perfil: ' + user.role,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreSinUltimo)}+${encodeURIComponent(ultimoCaracter)}&size=200`,
      },
    };
  }, [user]); // Sólo depende de "user"para evitar re-renders innecesarios

  // Actualizar `session` cada vez que `user` cambie
  useEffect(() => {
    if (Datasession) {
      setSession(Datasession);
    }
  }, [Datasession]);

  const authentication = {
    signIn: () => {
      setSession(Datasession);
    },
    signOut: () => {
      logout();
      setSession(null);
      navigate('/');
    },
  };

  return (
    <AppProvider
      branding={{
        // Era un PNG rojo fijo: un icono toma el color del tema, blanco en
        // modo oscuro y gris en modo claro.
        logo: (
          <UploadFileIcon
            sx={{
              fontSize: 30,
              color: '#607D8B',
              '[data-toolpad-color-scheme="dark"] &': { color: '#fff' },
            }}
          />
        ),
        title: '',
        color: '#455A64',
      }}
      navigation={[
        { kind: 'header', title: 'Menu' },
        { segment: 'dashboard', title: 'Dashboard', icon: <DashboardIcon /> },
        // { segment: 'inicio', title: 'Inicio', icon: <HomeIcon /> },
        {
          segment: 'CargaRD',
          title: 'Carga RD',
          icon: <IconoSigla>RD</IconoSigla>,
        },
        // RG está listo y probado, pero oculto hasta que se habilite para los
        // usuarios. Para mostrarlo alcanza con descomentar esto: la pantalla,
        // la ruta y el endpoint siguen enteros.
        // {
        //   segment: 'CargaRG',
        //   title: 'Carga RG',
        //   icon: <IconoSigla>RG</IconoSigla>,
        // },
        // Oculta por ahora. Para reactivarla, descomentar: la pantalla sigue entera.
        // {
        //   segment: 'CargaExcel',
        //   title: 'Carga de Excel',
        //   icon: <UploadFileIcon />,
        // },
        {
          segment: 'PantallaAfi',
          title: 'Responsables Cargados',
          icon: <GridViewIcon />,
        },
        { kind: 'divider' },
      ]}
      router={router}
      theme={customTheme}
    >
      <AuthenticationContext.Provider value={authentication}>
        <SessionContext.Provider value={session}>
          <DashboardLayout
            defaultSidebarCollapsed
            slotProps={{
              toolbarAccount: {
                localeText: {
                  signInLabel: 'Iniciar sesión',
                  signOutLabel: 'Cerrar sesión',
                },
                slots: {
                  popoverContent: (props) => (
                    <CustomMenu {...props} router={router} />
                  ),
                },
              },
            }}
          >
            <DemoPageContent pathname={router.pathname} navigate={navigate} />
          </DashboardLayout>
        </SessionContext.Provider>
      </AuthenticationContext.Provider>
    </AppProvider>
  );
}

export default DashboardLayoutPattern;
