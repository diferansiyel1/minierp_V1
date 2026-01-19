import React, { createContext, useContext, useState, useEffect } from 'react';


// Define User types based on backend schema
export interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'superadmin' | 'admin' | 'user';
    tenant_id: number | null;
    is_active: boolean;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthContextType extends AuthState {
    login: (token: string, user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import api from '../services/api';

// Re-export api if needed by other consumers of AuthContext (though they should import from services/api)
export { api };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true,
    });

    useEffect(() => {
        // Check for stored token on mount
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setState({
                    user,
                    token: storedToken,
                    isAuthenticated: true,
                    isLoading: false,
                });

                // Set default headers
                api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                if (user.tenant_id) {
                    api.defaults.headers.common['X-Tenant-ID'] = user.tenant_id.toString();
                }
            } catch (e) {
                console.error("Failed to parse stored user", e);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setState(prev => ({ ...prev, isLoading: false }));
            }
        } else {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    const login = (token: string, user: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Set default headers
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        if (user.tenant_id) {
            api.defaults.headers.common['X-Tenant-ID'] = user.tenant_id.toString();
        } else {
            delete api.defaults.headers.common['X-Tenant-ID'];
        }

        setState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
        });
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        delete api.defaults.headers.common['X-Tenant-ID'];

        setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        });
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
