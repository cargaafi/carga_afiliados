import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Routes/Login';
import Inicio from './Routes/Inicio';
import PrivateRoute from './Routes/PrivateRoute';
import Dashboard from './Components/Dashboard';
import { AuthProvider } from './Components/AuthContext';
import SetupInterceptors from './Components/SetupInterceptors';
import AuthInitializer from './Components/AuthInitializer';
import UserConfig from './Routes/UserConfig';
//import CargaExcel from './Routes/CargaExcel';
import PantallaAfi from './Routes/PantallaAfi';
function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename='/'>
        <AuthInitializer />
        <SetupInterceptors />
        <Routes>
          <Route path='/' element={<Navigate replace to='/login' />} />
          <Route path='/login' element={<Login />} />
          <Route path='/dashboard/*' element={<PrivateRoute />}>
            <Route path='' element={<Dashboard />}>
              <Route index element={<Navigate replace to='inicio' />} />
              <Route path='inicio' element={<Inicio />} />
              <Route index element={<Navigate replace to='cargaExcel' />} />
              <Route path='cargaExcel' element={<cargaExcel />} />
              <Route index element={<Navigate replace to='PantallaAfi' />} />
              <Route path='PantallaAfi' element={<PantallaAfi />} />
              <Route index element={<Navigate replace to='userConfig' />} />
              <Route path='userConfig' element={<UserConfig />} />
            </Route>
          </Route>
          <Route path='*' element={<Navigate replace to='/login' />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
