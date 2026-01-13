import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

const EARSIV_URL = 'https://earsivportal.efatura.gov.tr/intragiris.html';

const EArsiv: React.FC = () => {
    const [loadError, setLoadError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setLoadError(true);
        setIsLoading(false);
    };

    const openExternally = () => {
        window.open(EARSIV_URL, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">e-Arşiv Portal</h1>
                    <p className="text-sm text-gray-500">GİB e-Arşiv Fatura Portalı</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Yenile
                    </Button>
                    <Button onClick={openExternally}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Yeni Sekmede Aç
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative bg-white rounded-lg border shadow-sm overflow-hidden">
                {loadError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Portal Görüntülenemiyor
                        </h2>
                        <p className="text-gray-600 mb-6 max-w-md">
                            e-Arşiv Portal güvenlik nedeniyle uygulama içinde açılamıyor.
                            Lütfen yeni sekmede açın.
                        </p>
                        <Button size="lg" onClick={openExternally}>
                            <ExternalLink className="h-5 w-5 mr-2" />
                            e-Arşiv Portala Git
                        </Button>
                    </div>
                ) : (
                    <>
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                            </div>
                        )}
                        <iframe
                            src={EARSIV_URL}
                            className="w-full h-full border-0"
                            title="e-Arşiv Portal"
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        />
                    </>
                )}
            </div>

            {/* Info Footer */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                    <strong>Not:</strong> e-Arşiv Portal, Gelir İdaresi Başkanlığı'na aittir.
                    Giriş için İnteraktif Vergi Dairesi kullanıcı kodunuz ve şifreniz gereklidir.
                </p>
            </div>
        </div>
    );
};

export default EArsiv;
