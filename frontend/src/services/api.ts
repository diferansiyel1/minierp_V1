import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach auth + tenant headers on every request (works even before AuthProvider effect runs)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser) as { tenant_id?: number | null };
            if (user?.tenant_id) {
                config.headers = config.headers ?? {};
                (config.headers as any)['X-Tenant-ID'] = String(user.tenant_id);
            }
        } catch {
            // ignore parse errors
        }
    }

    return config;
});

// If token is invalid/expired (very common after redeploy if SECRET_KEY changed), force re-login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
