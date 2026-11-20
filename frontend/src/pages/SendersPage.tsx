import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  Mail,
  Plus,
  Trash2,
  Check,
  Star,
  Server,
  Zap,
  X,
  AlertTriangle,
} from 'lucide-react';

export const SendersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newHost, setNewHost] = useState('smtp.ethereal.email');
  const [newPort, setNewPort] = useState(587);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: senders, isLoading } = useQuery({
    queryKey: ['senders'],
    queryFn: () => api.senders.list(),
  });

  const autoEtherealMutation = useMutation({
    mutationFn: (displayName?: string) => api.senders.createEthereal(displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.message || 'Failed to generate Ethereal account');
    },
  });

  const createSenderMutation = useMutation({
    mutationFn: api.senders.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to create sender');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.senders.update(id, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.senders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || err.message || 'Failed to delete sender');
    },
  });

  const resetForm = () => {
    setNewEmail('');
    setNewDisplayName('');
    setNewHost('smtp.ethereal.email');
    setNewPort(587);
    setNewUser('');
    setNewPass('');
    setErrorMsg(null);
  };

  const handleManualCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newDisplayName) {
      setErrorMsg('Email and display name are required');
      return;
    }

    createSenderMutation.mutate({
      email: newEmail,
      displayName: newDisplayName,
      smtpHost: newHost,
      smtpPort: newPort,
      smtpUser: newUser || newEmail,
      smtpPass: newPass,
      isDefault: false,
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sender Identities</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure SMTP sender accounts used for dispatching scheduled campaigns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => autoEtherealMutation.mutate('Outbox Ethereal Test Sender')}
            disabled={autoEtherealMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Zap className="h-3.5 w-3.5 text-indigo-400" />
            <span>
              {autoEtherealMutation.isPending ? 'Generating Ethereal...' : 'Auto-Generate Ethereal Sender'}
            </span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Custom SMTP</span>
          </button>
        </div>
      </div>

      {/* Senders Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
          ))
        ) : senders && senders.length > 0 ? (
          senders.map((sender) => (
            <div
              key={sender.id}
              className={`p-5 rounded-xl border bg-slate-900/40 backdrop-blur-sm flex flex-col justify-between transition-all ${
                sender.isDefault ? 'border-indigo-500/50 shadow-md shadow-indigo-500/10' : 'border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <Mail className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-200 truncate">
                        {sender.displayName}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 truncate">{sender.email}</p>
                    </div>
                  </div>

                  {sender.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      <Star className="h-3 w-3 fill-indigo-400 text-indigo-400" />
                      <span>Default</span>
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3 w-3 text-slate-500" />
                    <span>
                      {sender.smtpHost}:{sender.smtpPort}
                    </span>
                  </div>
                  <div>User: {sender.smtpUser}</div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                {!sender.isDefault ? (
                  <button
                    onClick={() => setDefaultMutation.mutate(sender.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Set as default
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Active Sender
                  </span>
                )}

                <button
                  onClick={() => {
                    if (confirm(`Delete sender ${sender.email}?`)) {
                      deleteMutation.mutate(sender.id);
                    }
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Delete Sender"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl text-slate-500">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No sender identities registered</p>
            <p className="text-xs text-slate-600 mt-1">
              Click 'Auto-Generate Ethereal Sender' to create a test SMTP account instantly.
            </p>
          </div>
        )}
      </div>

      {/* Manual SMTP Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100">Add Custom SMTP Sender</h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleManualCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Sales Team"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="sales@yourcompany.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={newHost}
                    onChange={(e) => setNewHost(e.target.value)}
                    placeholder="smtp.mailgun.org"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">SMTP Username</label>
                  <input
                    type="text"
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    placeholder="postmaster@yourdomain.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">SMTP Password</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSenderMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-md shadow-indigo-600/30"
                >
                  {createSenderMutation.isPending ? 'Saving...' : 'Save Sender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
