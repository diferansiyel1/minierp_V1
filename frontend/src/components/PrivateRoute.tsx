import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface PrivateRouteProps {
    roles?: string[];
}

export default function PrivateRoute({ roles }: PrivateRouteProps) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && user && !roles.includes(user.role)) {
        // Redirect to dashboard if authorized but wrong role
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
