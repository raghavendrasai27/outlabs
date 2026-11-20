import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  Search,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Mail,
  Info,
  X,
} from 'lucide-react';

export const SentEmailsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedError, setSelectedError] = useState<{ email: string; error: string } | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sentEmails', page, searchTerm, statusFilter],
    queryFn: () => {
      if (searchTerm.trim()) {
        return api.emails.search({
          q: searchTerm.trim(),
          status: statusFilter || undefined,
          page,
          limit: 15,
        });
      }
      return api.emails.getSent(page, 15, statusFilter || undefined);
    },
    refetchInterval: 5000,
  });

  const totalPages = data?.totalPages || Math.ceil((data?.total || 0) / 15) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sent Emails History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed SMTP deliveries with live Ethereal preview URLs and error diagnosis.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search delivered emails by recipient, subject, or content..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent (Delivered)</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="px-6 py-3.5">Recipient</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Sender</th>
                <th className="px-6 py-3.5">Delivery Time</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-slate-800 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : data?.items && data.items.length > 0 ? (
                data.items.map((email: any) => (
                  <tr key={email.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-200">
                      {email.recipientEmail}
                    </td>
                    <td className="px-6 py-3.5 text-slate-300 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                      {email.sender?.email || email.senderEmail || 'Default'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-300 font-mono text-[11px]">
                      {email.sentAt ? (
                        new Date(email.sentAt).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {email.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="h-3 w-3" />
                            <span>SENT</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>FAILED</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {email.etherealPreviewUrl && (
                          <a
                            href={email.etherealPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[11px] font-medium transition-colors"
                          >
                            <span>Ethereal Preview</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {email.errorMessage && (
                          <button
                            onClick={() =>
                              setSelectedError({
                                email: email.recipientEmail,
                                error: email.errorMessage,
                              })
                            }
                            className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors"
                            title="View Error Details"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No sent emails recorded</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Emails dispatched by BullMQ workers will appear here with live preview links.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.total > 0 && (
          <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
            <div>
              Showing <span className="font-mono text-slate-200">{(page - 1) * 15 + 1}</span> to{' '}
              <span className="font-mono text-slate-200">
                {Math.min(page * 15, data.total)}
              </span>{' '}
              of <span className="font-mono text-slate-200">{data.total}</span> emails
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono px-2 text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Details Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>SMTP Delivery Failure</span>
              </div>
              <button
                onClick={() => setSelectedError(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block">Recipient:</span>
                <span className="font-mono text-slate-300">{selectedError.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Error Message:</span>
                <p className="p-3 bg-rose-950/20 border border-rose-500/20 rounded font-mono text-rose-300 whitespace-pre-wrap">
                  {selectedError.error}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedError(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
