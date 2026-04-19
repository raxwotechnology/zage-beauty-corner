import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';
import { loginUser } from '../services/api';
import { toast } from 'react-toastify';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  // If already logged in, show option or redirect
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectMap = { admin: '/admin', manager: '/manager', cashier: '/employee', deliveryGuy: '/employee', stockEmployee: '/employee' };
      navigate(redirectMap[user.role] || '/', { replace: true });
    }
  }, []);


  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await loginUser({ email, password });
      login(data);
      toast.success(`Welcome back, ${data.name}!`);
      const redirectMap = { admin: '/admin', manager: '/manager', cashier: '/employee', deliveryGuy: '/employee', stockEmployee: '/employee' };
      navigate(redirectMap[data.role] || '/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-orange-50 py-12">
      <motion.div
        className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-card-border w-full max-w-md mx-4"
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-primary-green inline-block mb-4">FreshCart</Link>
          <h1 className="text-2xl font-bold text-dark-navy mt-0 mb-2">Welcome Back</h1>
          <p className="text-muted-text m-0">Sign in to continue shopping</p>
        </div>

        <form onSubmit={submitHandler} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-navy mb-1.5" htmlFor="login-email">
              Email Address
            </label>
            <input
              type="email"
              id="login-email"
              className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none transition-all"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-dark-navy" htmlFor="login-password">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-primary-green hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                className="w-full border border-card-border rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none transition-all"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-text hover:text-dark-navy"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-green text-white font-semibold py-3.5 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-text">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-green font-semibold hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
