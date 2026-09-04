'use client';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HealthTimeline from '@/components/HealthTimeline';
import AppointmentScheduler from '@/components/AppointmentScheduler';
import ConversationalScheduler from '@/components/AISchedular';

function AppointmentsContent() {
    const [activeTab, setActiveTab] = useState('timeline');

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Medical Appointments</h1>

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

export default function AppointmentsPage() {
    return <AppointmentsContent />;
}
