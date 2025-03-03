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
          username: '...',
          role: '...'
        });
      }
      
    }, []);
  
    return null; // No renderiza nada, solo inicializa la autenticación
  }

  export default AuthInitializer;