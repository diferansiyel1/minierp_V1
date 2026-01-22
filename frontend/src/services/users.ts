import api from './api';


const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'superadmin' | 'admin' | 'user';
    is_active: boolean;
}

export interface UserCreate {
    email: string;
    full_name: string;
    password: string;
    role: 'admin' | 'user';
}

export const usersService = {
    getAll: async (): Promise<User[]> => {
        try {
            const response = await api.get(`${API_URL}/users/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    },

    create: async (data: UserCreate): Promise<User> => {
        try {
            const response = await api.post(`${API_URL}/users/`, data);
            return response.data;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },

    update: async (id: number, data: Partial<UserCreate>): Promise<User> => {
        try {
            const response = await api.put(`${API_URL}/users/${id}`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },

    delete: async (id: number): Promise<void> => {
        try {
            await api.delete(`${API_URL}/users/${id}`);
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
};
