import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  Mail,
  Clock,
  CheckCircle,
  AlertOctagon,
  Gauge,
  ArrowRight,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.emails.getStats(),
    refetchInterval: 5000, // Poll every 5s for live job counter updates
  });

  const { data: scheduledData } = useQuery({
    queryKey: ['scheduledEmails', 1, 5],
    queryFn: () => api.emails.getScheduled(1, 5),
    refetchInterval: 5000,
  });

  const { data: sentData } = useQuery({
    queryKey: ['sentEmails', 1, 5],
    queryFn: () => api.emails.getSent(1, 5),
    refetchInterval: 5000,
  });

  const metrics = [
    {
      title: 'Total Emails',
      value: stats?.totalEmails ?? 0,
      icon: Mail,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      title: 'Scheduled / In Queue',
      value: stats?.scheduledEmails ?? 0,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'Successfully Sent',
      value: stats?.sentEmails ?? 0,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Delivery Failed',
      value: stats?.failedEmails ?? 0,
      icon: AlertOctagon,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
    {
      title: 'Hourly Quota Left',
      value: stats?.remainingInHour ?? 200,
      icon: Gauge,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      subtitle: `Window: ${stats?.hourWindow || 'UTC'}`,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Queue Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monitoring of BullMQ persistent delayed queue, rate limits, and Ethereal SMTP delivery.
          </p>
        </div>

        {stats?.queueMetrics && (
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">BullMQ Active:</span>
              <span className="font-mono font-bold text-slate-200">{stats.queueMetrics.active}</span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Delayed:</span>
              <span className="font-mono font-bold text-slate-200">{stats.queueMetrics.delayed}</span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Completed:</span>
              <span className="font-mono font-bold text-emerald-400">{stats.queueMetrics.completed}</span>
            </div>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-xl border bg-slate-900/40 backdrop-blur-sm transition-all hover:border-slate-700 ${m.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{m.title}</span>
              <div className={`p-2 rounded-lg ${m.bgColor}`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
            </div>
            <div className="mt-3">
              {isStatsLoading ? (
                <div className="h-7 w-16 bg-slate-800 animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold font-mono text-slate-100">{m.value}</div>
              )}
              {m.subtitle && (
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{m.subtitle}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Upcoming & Recent Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Jobs Preview */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-200">Upcoming Scheduled Jobs</h3>
              </div>
              <Link
                to="/scheduled"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
              {scheduledData?.items && scheduledData.items.length > 0 ? (
                scheduledData.items.map((email: any) => (
                  <div key={email.id} className="px-6 py-3.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-4">
                      <p className="font-medium text-slate-200 truncate">{email.recipientEmail}</p>
                      <p className="text-slate-400 text-[11px] truncate">{email.subject}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {new Date(email.scheduledAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  <Layers className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No pending emails in scheduled queue.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recently Sent / Ethereal Delivery Preview */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <h3 className="font-semibold text-sm text-slate-200">Recently Delivered via SMTP</h3>
              </div>
              <Link
                to="/sent"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
              {sentData?.items && sentData.items.length > 0 ? (
                sentData.items.map((email: any) => (
                  <div key={email.id} className="px-6 py-3.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-4">
                      <p className="font-medium text-slate-200 truncate">{email.recipientEmail}</p>
                      <p className="text-slate-400 text-[11px] truncate">{email.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          email.status === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {email.status.toUpperCase()}
                      </span>
                      {email.etherealPreviewUrl && (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
                          title="View in Ethereal Mailbox"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  <Mail className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No delivered emails recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
