import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, Building2 } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
    });
    const [error, setError] = useState('');

    const loginMutation = useMutation({
        mutationFn: async (data: { email: string; password: string }) => {
            const response = await api.post('/auth/login', data);
            return response.data;
        },
        onSuccess: (data) => {
            localStorage.setItem('token', data.access_token);
            api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
            navigate('/');
        },
        onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
            setError(error.response?.data?.detail || 'Giriş başarısız');
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const response = await api.post('/auth/register', data);
            return response.data;
        },
        onSuccess: () => {
            setIsRegister(false);
            setError('');
            setFormData({ ...formData, full_name: '' });
        },
        onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
            setError(error.response?.data?.detail || 'Kayıt başarısız');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (isRegister) {
            registerMutation.mutate(formData);
        } else {
            loginMutation.mutate({ email: formData.email, password: formData.password });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">MiniERP</CardTitle>
                    <p className="text-gray-500 mt-1">
                        {isRegister ? 'Yeni hesap oluşturun' : 'Hesabınıza giriş yapın'}
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <div>
                                <Label htmlFor="fullName">Ad Soyad</Label>
                                <Input
                                    id="fullName"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Ad Soyad"
                                    required={isRegister}
                                />
                            </div>
                        )}
                        <div>
                            <Label htmlFor="email">E-posta</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="ornek@pikolab.com"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="password">Şifre</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loginMutation.isPending || registerMutation.isPending}
                        >
                            {isRegister ? (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    {registerMutation.isPending ? 'Kaydediliyor...' : 'Kayıt Ol'}
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4 mr-2" />
                                    {loginMutation.isPending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                                </>
                            )}
                        </Button>
                    </form>
                    <div className="mt-4 text-center">
                        <button
                            type="button"
                            className="text-sm text-blue-600 hover:underline"
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError('');
                            }}
                        >
                            {isRegister ? 'Zaten hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Kayıt olun'}
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
