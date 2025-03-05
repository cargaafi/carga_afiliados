import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Typography,
  Divider,
} from '@mui/material';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
//import { useNavigate } from 'react-router-dom';  USUARIO CON RECOIL O SECUENCIAL , VER ESO PARA LOS ROLES
import { API_URL } from '../Config/Config';
//import GridUsers from '../charts/GridUsers.js';
import Swal from 'sweetalert2';
import { GoPasskeyFill } from 'react-icons/go';
import { FaUserPlus } from 'react-icons/fa6';
import { useAuth } from '../Components/AuthContext'; // Importa el contexto de autenticación
import Grid from '@mui/material/Grid2'; // Usando Grid2
import { alpha, styled } from '@mui/material/styles';
import GridUsers from '../Grids/GridUsers';
const userColumns = [
  { field: 'id', headerName: 'ID', flex: 1 },
  {
    field: 'user',
    headerName: 'Usuario',
    flex: 1,
    editable: false,
  },
  {
    field: 'role',
    headerName: 'Rol',
    flex: 1,
    editable: false,
  },
];
function UserCreate() {
  const { userCreate, setUserCreate, user } = useAuth();
  const [listUser, setListUser] = useState([]);
  const [valueTab, setValueTab] = useState('createUser');
  const [newPass, setNewPass] = useState('');
  const handleChange = (event, newValue) => {
    setValueTab(newValue);
  };

  const CssTextField = styled(TextField)({
    '& label.Mui-focused': {
      color: '#A0AAB4',
    },
    '& .MuiInput-underline:after': {
      borderBottomColor: '#8f2e2e',
    },
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderColor: '#8f2e2e',
      },
      '&:hover fieldset': {
        borderColor: '#8f2e2e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#8f2e2e',
      },
    },
  });

  const handleUserInput = (event) => {
    const { name, value } = event.target;
    setUserCreate((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addNewUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/createUser`, {
        username: userCreate.username,
        role: userCreate.role,
        password: userCreate.password,
      });
      Swal.fire({
        title: 'Usuario creado!',
        text: `Su nuevo Usuario es: ${userCreate.username} y Contraseña: ${userCreate.password}`,
        icon: 'success',
        confirmButtonColor: '#8f2e2e', // Aquí tu color personalizado
        confirmButtonText: 'Aceptar',
      });
    } catch (err) {
      if (err.response?.data.code === 'USER_DUPLI') {
        Swal.fire({
          title: 'Oops...',
          text: `Este nombre de usuario ya existe, por favor elija otro`,
          icon: 'error',
          confirmButtonColor: '#8f2e2e', // Aquí tu color personalizado
          confirmButtonText: 'Aceptar',
        });
      }
    }
  };

  const getUserData = async () => {
    try {
      const response = await axios.get(`${API_URL}/getUserList`);
      setListUser(response.data);
    } catch (err) {
      if (err.response?.status === 403) {
        Swal.fire({
          icon: 'error',
          title: 'Mensaje de seguridad',
          text: 'El token expiró, por favor inicie sesión nuevamente',
        });
      } else {
        Swal.fire(
          'Ooops',
          'No se puede traer la información desde la BD',
          'error'
        );
      }
    }
  };
  useEffect(() => {
    getUserData();
  }, []);
  const passReset = async (e) => {
    e.preventDefault();
    // Muestra en consola los valores que se van a enviar

    try {
      await axios.put(`${API_URL}/resetPass`, {
        username: user.username,
        password: newPass,
      });

      Swal.fire({
        title: 'Contraseña Actualizada!',
        text: `Su nueva contraseña es: ${newPass}`,
        icon: 'success',
        confirmButtonColor: '#8f2e2e', // Aquí tu color personalizado
        confirmButtonText: 'Aceptar',
      });
    } catch (error) {
      Swal.fire(
        'Ooops',
        'Fallo al actualizar su contraseña, salga del sistema e intente nuevamente',
        'error'
      );
    }
  };

  const handleDelete = async (id) => {
    Swal.fire({
      title: 'Estas seguro?',
      text: 'No se puede revertir esta acción!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Si, Borralo!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        await axios.delete(`${API_URL}/deleteUser/${id}`);
        setListUser(listUser.filter((user) => user.id !== id));
        Swal.fire('Borrado!', 'El usuario fue borrado.', 'success');
      }
    });
  };
  return (
    <>
      <Container sx={{ mb: 5 }}>
        <Box sx={{ width: '100%', mt: 5, pt: 0 }}>
          <Card>
            <Typography variant='h3' sx={{ color: '#8f2e2e' }}>
              Administración de Usuarios
            </Typography>
            <CardContent>
              <Tabs value={valueTab} onChange={handleChange} centered>
                <Tab label='Crear de Usuario' value='createUser' />
                <Tab label='Restablecer Contraseña' value='resetPassword' />
              </Tabs>
              {valueTab === 'createUser' && (
                <Box component='form' onSubmit={addNewUser} sx={{ mt: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      mt: 2,
                    }}
                  >
                    <Grid container spacing={2} justifyContent='center'>
                      {/* Columna de Datos de Solo Lectura */}
                      <Grid size={{ xs: 12, md: 8 }}>
                        <Box>
                          <Typography variant='h6'>
                            Ingrese el nuevo usuario{' '}
                          </Typography>
                          <Divider sx={{ mb: 1 }} />
                          <Grid container spacing={1} justifyContent='center'>
                            <Grid size={{ xs: 12, md: 4 }}>
                              <TextField
                                fullWidth
                                label='Usuario'
                                name='username'
                                required
                                onChange={handleUserInput}
                                size='small'
                              />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                              <FormControl fullWidth size='small'>
                                <InputLabel id='role-select-label'>
                                  Tipo de Usuario
                                </InputLabel>
                                <Select
                                  labelId='role-select-label'
                                  id='role-select'
                                  value={userCreate.role}
                                  label='Tipo de Usuario'
                                  name='role'
                                  onChange={handleUserInput}
                                >
                                  <MenuItem value='operador'>Operador</MenuItem>
                                  <MenuItem value='consulta'>Consulta</MenuItem>
                                  <MenuItem value='admin'>
                                    Administrador
                                  </MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                              <TextField
                                fullWidth
                                label='Contraseña'
                                type='password'
                                name='password'
                                required
                                onChange={handleUserInput}
                                size='small'
                              />
                            </Grid>
                            <Grid size={{ xs: 12, md: 2 }}>
                              <Button
                                variant='contained'
                                type='submit'
                                size='small'
                                className='ClaseDeTuBoton'
                                endIcon={<FaUserPlus />}
                                sx={{ mt: 2 }}
                              >
                                Crear
                              </Button>
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              {valueTab === 'resetPassword' && (
                <Box component='form' onSubmit={passReset}>
                  <Grid container spacing={2} justifyContent='center'>
                    {/* Reseteo de Contraseña */}
                    <Grid size={{ xs: 12, md: 8 }}>
                      <Typography variant='h6'>
                        <p>Usuario actual: {user.username}</p>
                      </Typography>
                      <Divider sx={{ mb: 2, mt: 1 }} />
                      <Grid container spacing={2} justifyContent='center'>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label='Contraseña Nueva'
                            type='password'
                            required
                            onChange={(e) => setNewPass(e.target.value)}
                            size='small'
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                          <Button
                            variant='contained'
                            type='submit'
                            size='small'
                            className='ClaseDeTuBoton'
                            sx={{ mt: 0.5 }}
                            endIcon={<GoPasskeyFill />}
                          >
                            Actualizar
                          </Button>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
          <Grid container justifyContent='center' sx={{ mt: 4 }}>
            <Grid size={2}></Grid>
          </Grid>
        </Box>
        <Box sx={{ mt: 5 }}>
          <Grid container justifyContent='center'>
            <Grid size={12}>
              <Card>
                <CardHeader title='Lista de Usuarios' />
                <CardContent>
                  <GridUsers
                    rows={listUser}
                    columnsVar={userColumns}
                    onDelete={handleDelete}
                    fileNameVar='UserList'
                    showDeleteColumn={true}
                  />{' '}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </>
  );
}

export default UserCreate;
