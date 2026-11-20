import axios from 'axios';
import type {
  DashboardStats,
  ScheduledEmail,
  Sender,
  Campaign,
  SlackStatus,
  SchedulingResponse,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('reachinbox_token');
      localStorage.removeItem('reachinbox_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  auth: {
    me: async (): Promise<User> => {
      const res = await apiClient.get('/auth/me');
      return res.data.user;
    },
    googleLogin: async (credentialOrCode: { credential?: string; code?: string }) => {
      const res = await apiClient.post('/auth/google', credentialOrCode);
      return res.data;
    },
    demoLogin: async (data?: { email?: string; name?: string }): Promise<{ success: boolean; token: string; user: User }> => {
      const res = await apiClient.post('/auth/demo', data || {});
      return res.data;
    },
    logout: async () => {
      const res = await apiClient.post('/auth/logout');
      return res.data;
    },
  },

  // Senders
  senders: {
    list: async (): Promise<Sender[]> => {
      const res = await apiClient.get('/senders');
      return res.data.data;
    },
    create: async (data: Partial<Sender>) => {
      const res = await apiClient.post('/senders', data);
      return res.data.data;
    },
    createEthereal: async (displayName?: string): Promise<Sender> => {
      const res = await apiClient.post('/senders/auto-ethereal', { displayName });
      return res.data.data;
    },
    update: async (id: string, data: { displayName?: string; isDefault?: boolean }) => {
      const res = await apiClient.patch(`/senders/${id}`, data);
      return res.data.data;
    },
    delete: async (id: string) => {
      const res = await apiClient.delete(`/senders/${id}`);
      return res.data;
    },
  },

  // Emails
  emails: {
    schedule: async (payload: {
      subject: string;
      body: string;
      senderId?: string;
      recipients?: string[];
      csvContent?: string;
      startTime?: string;
      delayBetweenEmails?: number;
      hourlyLimit?: number;
    }): Promise<SchedulingResponse> => {
      const res = await apiClient.post('/emails/schedule', payload);
      return res.data.data;
    },
    getScheduled: async (page = 1, limit = 20) => {
      const res = await apiClient.get(`/emails/scheduled?page=${page}&limit=${limit}`);
      return res.data.data;
    },
    getSent: async (page = 1, limit = 20, status?: string) => {
      const statusParam = status ? `&status=${status}` : '';
      const res = await apiClient.get(`/emails/sent?page=${page}&limit=${limit}${statusParam}`);
      return res.data.data;
    },
    getStats: async (): Promise<DashboardStats> => {
      const res = await apiClient.get('/emails/stats');
      return res.data.data;
    },
    search: async (params: { q?: string; status?: string; page?: number; limit?: number }) => {
      const res = await apiClient.get('/emails/search', { params });
      return res.data.data;
    },
    getById: async (id: string): Promise<ScheduledEmail> => {
      const res = await apiClient.get(`/emails/${id}`);
      return res.data.data;
    },
  },

  // Campaigns
  campaigns: {
    list: async (): Promise<Campaign[]> => {
      const res = await apiClient.get('/campaigns');
      return res.data.data;
    },
    getById: async (id: string): Promise<Campaign> => {
      const res = await apiClient.get(`/campaigns/${id}`);
      return res.data.data;
    },
  },

  // Slack
  slack: {
    connectUrl: async (): Promise<string> => {
      const res = await apiClient.get('/slack/connect');
      return res.data.url;
    },
    status: async (): Promise<SlackStatus> => {
      const res = await apiClient.get('/slack/status');
      return res.data.data;
    },
    disconnect: async () => {
      const res = await apiClient.post('/slack/disconnect');
      return res.data;
    },
  },
};
