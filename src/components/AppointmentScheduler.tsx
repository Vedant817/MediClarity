'use client';
import EnhancedAppointmentFlow from './AppointmentFlow';
import { Doctors } from '@/lib/data';

export default function AppointmentScheduler() {
    return <EnhancedAppointmentFlow providers={Doctors} />;
}