import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  X,
  Send,
  Upload,
  FileText,
  Clock,
  Gauge,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  // Recipient input & CSV parsing
  const [manualRecipients, setManualRecipients] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validEmails, setValidEmails] = useState<string[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [showRecipientDrawer, setShowRecipientDrawer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load available senders
  const { data: senders } = useQuery({
    queryKey: ['senders'],
    queryFn: () => api.senders.list(),
    enabled: isOpen,
  });

  // Set default sender if available
  React.useEffect(() => {
    if (senders && senders.length > 0 && !senderId) {
      const defaultOne = senders.find((s) => s.isDefault) || senders[0];
      setSenderId(defaultOne.id);
    }
  }, [senders, senderId]);

  // Handle CSV file upload & parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseRecipientsFromText(text);
    };

    reader.readAsText(file);
  };

  const parseRecipientsFromText = (rawText: string) => {
    const lines = rawText.split(/[\r\n,;]+/);
    const valid = new Set<string>();
    const invalid = new Set<string>();

    for (const item of lines) {
      const trimmed = item.trim().replace(/^["']|["']$/g, '');
      if (!trimmed || trimmed.toLowerCase() === 'email' || trimmed.toLowerCase() === 'recipient') {
        continue;
      }

      if (EMAIL_REGEX.test(trimmed)) {
        valid.add(trimmed.toLowerCase());
      } else if (trimmed.length > 3) {
        invalid.add(trimmed);
      }
    }

    setValidEmails(Array.from(valid));
    setInvalidEmails(Array.from(invalid));
  };

  // Synchronize manual textarea changes
  const handleManualRecipientsChange = (val: string) => {
    setManualRecipients(val);
    setUploadedFileName(null);
    parseRecipientsFromText(val);
  };

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: api.emails.schedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
      queryClient.invalidateQueries({ queryKey: ['sentEmails'] });
      handleClose();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || err.message || 'Failed to schedule campaign');
    },
  });

  const handleClose = () => {
    setSubject('');
    setBody('');
    setManualRecipients('');
    setUploadedFileName(null);
    setValidEmails([]);
    setInvalidEmails([]);
    setFormError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!subject.trim()) {
      setFormError('Subject is required');
      return;
    }
    if (!body.trim()) {
      setFormError('Email body is required');
      return;
    }
    if (validEmails.length === 0) {
      setFormError('At least one valid recipient email address is required');
      return;
    }
    if (!senderId) {
      setFormError('Please select or configure a sender identity');
      return;
    }

    let startTimeISO: string | undefined = undefined;
    if (scheduleType === 'scheduled' && scheduledDate && scheduledTime) {
      const dt = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(dt.getTime())) {
        setFormError('Invalid start date and time specified');
        return;
      }
      startTimeISO = dt.toISOString();
    }

    scheduleMutation.mutate({
      subject,
      body,
      senderId,
      recipients: validEmails,
      startTime: startTimeISO,
      delayBetweenEmails: delayBetweenMs,
      hourlyLimit,
    });
  };

  if (!isOpen) return null;

  // Calculation estimates
  const estimatedSeconds = Math.ceil((validEmails.length * delayBetweenMs) / 1000);
  const now = new Date();
  const startTime =
    scheduleType === 'scheduled' && scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`)
      : now;
  const estimatedEndTime = new Date(startTime.getTime() + estimatedSeconds * 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#111827] border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Schedule Email Campaign</h2>
            <p className="text-xs text-slate-400">
              Queue emails via BullMQ with atomic rate limits & Ethereal SMTP
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Sender & Start Time Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                From (Sender Identity)
              </label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {senders?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email}) {s.isDefault ? '— [Default]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Dispatch Schedule
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType('immediate')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                    scheduleType === 'immediate'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Send Immediately
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('scheduled')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                    scheduleType === 'scheduled'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Schedule Later
                </button>
              </div>
            </div>
          </div>

          {/* Future schedule date & time picker */}
          {scheduleType === 'scheduled' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Start Time (UTC/Local)</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exciting opportunity with ReachInbox"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Message Body
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hello,&#10;&#10;We are pleased to invite you to our platform..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />
          </div>

          {/* Recipients CSV / Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Recipients (Upload CSV or paste addresses)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload CSV / TXT</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {uploadedFileName ? (
              <div className="flex items-center justify-between px-3.5 py-3 bg-slate-900/90 border border-indigo-500/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-medium text-slate-200">{uploadedFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFileName(null);
                    setValidEmails([]);
                    setInvalidEmails([]);
                  }}
                  className="text-slate-500 hover:text-rose-400 text-xs"
                >
                  Remove
                </button>
              </div>
            ) : (
              <textarea
                rows={3}
                value={manualRecipients}
                onChange={(e) => handleManualRecipientsChange(e.target.value)}
                placeholder="alice@corp.com, bob@example.org, charlie@startup.io"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            )}

            {/* Parsing Stats Badge Chips */}
            {(validEmails.length > 0 || invalidEmails.length > 0) && (
              <div className="mt-2 flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>{validEmails.length} valid recipient{validEmails.length !== 1 ? 's' : ''}</span>
                  </div>
                  {invalidEmails.length > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{invalidEmails.length} invalid</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowRecipientDrawer(!showRecipientDrawer)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <span>{showRecipientDrawer ? 'Hide preview' : 'Preview list'}</span>
                  {showRecipientDrawer ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            )}

            {/* Recipient Drawer */}
            {showRecipientDrawer && validEmails.length > 0 && (
              <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-lg max-h-32 overflow-y-auto text-xs font-mono text-slate-300 space-y-1">
                {validEmails.slice(0, 50).map((email, idx) => (
                  <div key={idx} className="truncate">
                    {idx + 1}. {email}
                  </div>
                ))}
                {validEmails.length > 50 && (
                  <div className="text-slate-500 italic">
                    ...and {validEmails.length - 50} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Throttling & Limits Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-900/40 rounded-xl border border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Delay Between Emails</span>
                </label>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {(delayBetweenMs / 1000).toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min="2000"
                max="10000"
                step="500"
                value={delayBetweenMs}
                onChange={(e) => setDelayBetweenMs(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Min 2000ms enforced across distributed workers
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Hourly Quota Limit</span>
                </label>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {hourlyLimit} / hr
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Exceeded jobs automatically shift to next hour window
              </p>
            </div>
          </div>

          {/* Confirmation Summary Card */}
          {validEmails.length > 0 && (
            <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-xs space-y-1 text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                <Info className="h-3.5 w-3.5" />
                <span>Scheduling Execution Summary</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Total Emails:</span>
                  <span className="font-semibold text-slate-200">{validEmails.length}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Est. Duration:</span>
                  <span className="font-semibold text-slate-200">
                    {estimatedSeconds > 60
                      ? `${Math.round(estimatedSeconds / 60)} min`
                      : `${estimatedSeconds} sec`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Completion:</span>
                  <span className="font-semibold text-slate-200">
                    {estimatedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit & Cancel */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduleMutation.isPending || validEmails.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              <span>{scheduleMutation.isPending ? 'Scheduling Jobs...' : 'Schedule Campaign'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
