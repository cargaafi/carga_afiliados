import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';

function SetupInterceptors() {
  const navigate = useNavigate();

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 403) {
          Swal.fire({
            icon: 'error',
            title: 'Mensaje de seguridad',
            text: 'Su sesión ha expirado, por favor inicie sesión nuevamente',
          });
          localStorage.removeItem('jwtToken');
          axios.defaults.headers.common['Authorization'] = '';
          navigate('/login', { replace: true });
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  return null;  // No renderiza nada, solo configura interceptores
}
export default SetupInterceptors;