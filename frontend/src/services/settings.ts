import axios from 'axios';

const API_URL = '/api';

export interface SystemSetting {
    key: string;
    value: string;
    description?: string;
    updated_at: string;
}

export const settingsService = {
    getAll: async () => {
        const response = await axios.get<SystemSetting[]>(`${API_URL}/settings/`);
        return response.data;
    },

    get: async (key: string) => {
        const response = await axios.get<SystemSetting>(`${API_URL}/settings/${key}`);
        return response.data;
    },

    update: async (key: string, value: string, description?: string) => {
        const response = await axios.put<SystemSetting>(`${API_URL}/settings/${key}/`, {
            value,
            description,
        });
        return response.data;
    }
};
