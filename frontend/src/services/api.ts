import axios from 'axios';

const api = axios.create({
    // Hardcode to /api to ensure it always uses the Nginx proxy in Docker
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
