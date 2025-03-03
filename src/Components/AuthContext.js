import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isLogin, setIsLogin] = useState(false);

  const [user, setUser] = useState({
    username: '',
    role: '',
  });

  const [userCreate, setUserCreate] = useState({
    username: '',
    role: '',
    password: '',
  });

  const login = (userData) => {
    setIsLogin(true);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('jwtToken');
    setUser({ username: '', role: '' });
    setIsLogin(false);
  };

  return (
    <AuthContext.Provider
      value={{ isLogin, login, logout, user, userCreate, setUserCreate }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
