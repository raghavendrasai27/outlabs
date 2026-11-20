import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Bell,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SlackIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: slackStatus, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['slackStatus'],
    queryFn: () => api.slack.status(),
  });

  const connectSlack = async () => {
    try {
      const url = await api.slack.connectUrl();
      window.location.href = url;
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to initialize Slack OAuth redirect');
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: api.slack.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.message || 'Failed to disconnect Slack');
    },
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings & Integrations</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage Slack real-time rate limit alerts, API keys, and account parameters.
        </p>
      </div>

      {/* Slack Integration Card */}
      <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl space-y-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#4A154B]/30 border border-[#4A154B]/60 rounded-xl">
              <SlackIcon className="h-6 w-6 text-[#E01E5A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Slack OAuth 2.0 Integration</span>
                {slackStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <AlertCircle className="h-3 w-3" />
                    Not Connected
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically alerts your Slack workspace when a sender reaches their hourly email quota.
              </p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Integration Details / Connection Action */}
        {isLoading ? (
          <div className="h-20 bg-slate-800/60 rounded-lg animate-pulse" />
        ) : slackStatus?.connected ? (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Connected Workspace:</span>
                <span className="font-semibold text-slate-200">{slackStatus.teamName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Workspace ID:</span>
                <span className="font-mono text-slate-300">{slackStatus.teamId}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-emerald-400" />
                Hourly rate-limit notifications active (deduplicated per window)
              </span>

              <button
                onClick={() => {
                  if (confirm('Disconnect Slack workspace?')) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect Slack</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 bg-slate-950/40 border border-slate-800/60 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-200">Connect your team's Slack channel</p>
              <p>
                Receive structured alerts with sender email, hourly limit, delayed count, and the next scheduled execution window.
              </p>
            </div>

            <button
              onClick={connectSlack}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#4A154B] hover:bg-[#611f69] text-white rounded-lg text-xs font-semibold shadow-lg shadow-[#4A154B]/30 transition-all flex-shrink-0"
            >
              <SlackIcon className="h-4 w-4" />
              <span>Connect Slack</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </button>
          </div>
        )}
      </div>

      {/* Account Info Card */}
      <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl space-y-4 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Shield className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">User Identity & Authentication</h2>
            <p className="text-xs text-slate-400">Isolated tenant account verified via Google OAuth 2.0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[11px]">User ID</span>
            <span className="font-mono text-slate-300 truncate block mt-0.5">{user?.id}</span>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[11px]">Name</span>
            <span className="font-medium text-slate-200 block mt-0.5">{user?.name}</span>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[11px]">Email</span>
            <span className="font-mono text-slate-300 truncate block mt-0.5">{user?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
