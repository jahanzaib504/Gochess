import { useContext, useState } from 'react';
import api from '../api.js';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import AuthContext from '../components/AuthContext.jsx';

const LogIn = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ email: '', password: '' });
  const { setAuth, setLoading, setUserInfo } = useContext(AuthContext);

  const handle_field_change = (e) => {
    const { id, value } = e.target;
    setUser((prev) => ({ ...prev, [id]: value }));
  };

  const handle_submit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/log-in', user);
      console.log(response);
      const token = response.data.token;
     

      // Set token and user info in local storage and context.
      localStorage.setItem('token', token);
      const userInfo = (await api.get('/get_user_info')).data.user

      setUserInfo(userInfo);
      setAuth(true);  // Set auth to true once login is successful.
      navigate('/'); // Navigate to the home page after successful login.
    } catch (error) {
      setAuth(false); // Set auth to false if login fails.
      toast.error(error?.response?.data?.message || error?.message || 'Login failed');
      console.log('Login failed', error);
    }finally{
      setLoading(false); // Stop loading even if there’s an error.
    }
  };

  return (
    <div className="flex justify-center items-center h-screen w-screen bg-red-50 bg-[url('/chess-bg.jpeg')] bg-cover bg-center bg-no-repeat">
      <div className="flex flex-col items-center gap-6 p-8 bg-white/30 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full">
        <img src="/logo.svg" alt="Logo" className="w-20 h-20" />
        <h1 className="text-2xl font-semibold text-white">Welcome to Gochess</h1>
        <form className="flex flex-col gap-4 w-full" onSubmit={handle_submit}>
          <div className="flex flex-col">
            <label htmlFor="email" className="text-sm text-white mb-1">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              required
              className="px-4 py-2 rounded-lg bg-white/70 focus:outline-none focus:ring-2 focus:ring-red-300"
              onChange={handle_field_change}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password" className="text-sm text-white mb-1">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              minLength="6"
              required
              placeholder="Enter your password"
              className="px-4 py-2 rounded-lg bg-white/70 focus:outline-none focus:ring-2 focus:ring-red-300"
              onChange={handle_field_change}
            />
          </div>

          <button
            type="submit"
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md"
          >
            Log In
          </button>
          <small className='text-red-600 flex justify-center gap-2'>Dont have an account<Link to='/sign-up' className='flex underline'>Sign up</Link></small>
          </form>
      </div>
    </div>
  );
};

export default LogIn;
