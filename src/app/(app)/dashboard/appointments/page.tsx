'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from 'lucide-react';
import HealthTimeline from '@/components/HealthTimeline';
import AppointmentScheduler from '@/components/AppointmentScheduler';
import ConversationalScheduler from '@/components/AISchedular';

export default function AppointmentsPage() {
    const [activeTab, setActiveTab] = useState('timeline');
    const searchParams = useSearchParams();
    const showSuccess = searchParams.get('success') === 'true';

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Medical Appointments</h1>

            {showSuccess && (
                <Alert className="mb-6 bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle>Success!</AlertTitle>
                    <AlertDescription>
                        Your appointment has been scheduled successfully.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                <TabsList className="grid grid-cols-3 mb-2 space-x-2">
                    <TabsTrigger className='cursor-pointer hover:bg-teal-100' value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger className='cursor-pointer hover:bg-teal-100' value="schedule">Schedule</TabsTrigger>
                    <TabsTrigger className='cursor-pointer hover:bg-teal-100' value="ai-scheduler">AI Scheduler</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                    <HealthTimeline />
                </TabsContent>
                <TabsContent value="schedule">
                    <AppointmentScheduler />
                </TabsContent>
                <TabsContent value="ai-scheduler">
                    <ConversationalScheduler />
                </TabsContent>
            </Tabs>
        </div>
    );
}