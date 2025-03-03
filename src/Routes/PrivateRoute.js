import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';

const PrivateRoute = () => {
  const { isLogin } = useAuth();
  return isLogin ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;