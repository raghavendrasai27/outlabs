import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { RefreshCw } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleAuth = async () => {
      const token = searchParams.get('token');
      if (token) {
        localStorage.setItem('reachinbox_token', token);
        try {
          const user = await api.auth.me();
          login(token, user);
          navigate('/');
        } catch {
          navigate('/login?error=Failed+to+fetch+user+session');
        }
      } else {
        navigate('/login?error=Authentication+token+missing');
      }
    };

    handleAuth();
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center text-slate-300 space-y-3 font-sans">
      <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium">Authenticating Google Session...</p>
    </div>
  );
};
