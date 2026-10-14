import {useEffect} from "react";
import { useAuth } from '../Components/AuthContext';
import axios from "axios";
function AuthInitializer() {
    const { login } = useAuth();
  
    useEffect(() => {
      const token = localStorage.getItem('jwtToken');
      if (token) {
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        login({
          username: localStorage.getItem('usuario') || '',
          role: localStorage.getItem('rol') || ''
        });
      }
      // corre una sola vez al montar: login cambia en cada render y meterlo
      // como dependencia dispararia el efecto en bucle
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    return null; // No renderiza nada, solo inicializa la autenticación
  }

  export default AuthInitializer;