import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import AuthContext from './components/AuthContext';
import AuthRoute from './components/AuthRoute';
import LogIn from './pages/login';
import SignUp from './pages/signup';
import GamePage from './pages/game';
import HomePage from './pages/home';
import api from './api';

function App() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({
    userid: -1,
    username: '',
    email: '',
    joined_date: '',
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await api.get('/get_user_info');
        const userData = response.data.user;
        setUserInfo(userData);
        setAuth(true);
      } catch (error) {
        console.log(error.response?.data?.message || 'Error fetching user data');
        setAuth(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);



  return (
    <>
    <AuthContext.Provider value={{ auth, loading, userInfo, setAuth, setLoading, setUserInfo }}>
      <Routes>
        <Route path='/log-in' element={<LogIn />} />
        <Route path='/sign-up' element={<SignUp />} />

        {/* Only authenticated users can access these routes */}
        <Route index element={<AuthRoute><HomePage /></AuthRoute>} />
        <Route path='/play' element={<AuthRoute><GamePage /></AuthRoute>} />

      </Routes>
    </AuthContext.Provider>
    <ToastContainer/>
    </>
  );
}

export default App;
