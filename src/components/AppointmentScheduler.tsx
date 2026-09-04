'use client';
import { useEffect, useState } from 'react';
import EnhancedAppointmentFlow from './AppointmentFlow';

type Provider = { id: string; name: string; specialty: string };

export default function AppointmentScheduler() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/providers')
            .then(async (response) => {
                if (!response.ok) throw new Error('Providers could not be loaded');
                return response.json() as Promise<{ providers: Provider[] }>;
            })
            .then((data) => setProviders(data.providers))
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p className="p-6 text-sm text-gray-500">Loading configured providers…</p>;
    if (error) return <p className="p-6 text-sm text-red-700">{error}</p>;
    if (providers.length === 0) return <p className="p-6 text-sm text-gray-500">No providers are currently configured for appointment booking.</p>;
    return <EnhancedAppointmentFlow providers={providers} />;
}
