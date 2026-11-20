import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Send,
  Mail,
  Settings,
  LogOut,
  Plus,
  Radio,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { ComposeModal } from '../components/ComposeModal';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const { data: slackStatus } = useQuery({
    queryKey: ['slackStatus'],
    queryFn: () => api.slack.status(),
    refetchInterval: 15000,
  });

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Scheduled Emails', path: '/scheduled', icon: Clock },
    { name: 'Sent Emails', path: '/sent', icon: Send },
    { name: 'Sender Accounts', path: '/senders', icon: Mail },
    { name: 'Settings & Slack', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#0B0F17] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#0F172A]/80 border-r border-slate-800/80 flex flex-col justify-between backdrop-blur-md">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/60">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-wide bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                ReachInbox
              </span>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Job Scheduler
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}

            {/* Live BullMQ Dashboard link */}
            <a
              href={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>Live BullMQ Queue</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
            </a>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-9 w-9 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 flex items-center justify-center font-bold text-xs">
                {user?.name?.slice(0, 2).toUpperCase() || 'US'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Authorized User'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-[#0F172A]/50 border-b border-slate-800/80 px-8 flex items-center justify-between backdrop-blur-md">
          {/* Slack Status Indicator */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs cursor-pointer hover:border-slate-600 transition-colors"
            >
              {slackStatus?.connected ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-300">
                    Slack Connected <span className="text-slate-500 font-mono">({slackStatus.teamName})</span>
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-slate-400">Slack Disconnected (Click to Connect)</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsComposeOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Compose Email</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Compose Modal */}
      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </div>
  );
};
