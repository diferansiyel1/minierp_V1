import axios from 'axios';


const API_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

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
            const response = await axios.get(`${API_URL}/users/`, { headers: getHeaders() });
            return response.data;
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    },

    create: async (data: UserCreate): Promise<User> => {
        try {
            const response = await axios.post(`${API_URL}/users/`, data, { headers: getHeaders() });
            return response.data;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },

    update: async (id: number, data: Partial<UserCreate>): Promise<User> => {
        try {
            const response = await axios.put(`${API_URL}/users/${id}`, data, { headers: getHeaders() });
            return response.data;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },

    delete: async (id: number): Promise<void> => {
        try {
            await axios.delete(`${API_URL}/users/${id}`, { headers: getHeaders() });
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
};
