type TimeSlot = {
  time: string;
  available: boolean;
};

type AvailabilityData = {
  slots: number;
  timeSlots: TimeSlot[];
};

type ProviderAvailability = Record<string, AvailabilityData>;

const providerAvailabilityMock: Record<string, ProviderAvailability> = {
  'dr-smith': {
    '2025-05-05': {
      slots: 4,
      timeSlots: [
        { time: '09:00 AM', available: true },
        { time: '10:00 AM', available: true },
        { time: '11:00 AM', available: true },
        { time: '02:00 PM', available: true },
      ]
    },
    '2025-05-06': {
      slots: 3,
      timeSlots: [
        { time: '09:00 AM', available: true },
        { time: '10:00 AM', available: true },
        { time: '03:00 PM', available: true },
      ]
    },
    '2025-05-07': {
      slots: 2,
      timeSlots: [
        { time: '01:00 PM', available: true },
        { time: '02:00 PM', available: true },
      ]
    },
  },
  'dr-johnson': {
    '2025-05-05': {
      slots: 3,
      timeSlots: [
        { time: '09:30 AM', available: true },
        { time: '10:30 AM', available: true },
        { time: '11:30 AM', available: true },
      ]
    },
    '2025-05-06': {
      slots: 4,
      timeSlots: [
        { time: '08:30 AM', available: true },
        { time: '09:30 AM', available: true },
        { time: '01:30 PM', available: true },
        { time: '02:30 PM', available: true },
      ]
    },
    '2025-05-08': {
      slots: 2,
      timeSlots: [
        { time: '01:30 PM', available: true },
        { time: '02:30 PM', available: true },
      ]
    },
  },
  'dr-williams': {
    '2025-05-05': {
      slots: 5,
      timeSlots: [
        { time: '08:00 AM', available: true },
        { time: '09:00 AM', available: true },
        { time: '10:00 AM', available: true },
        { time: '02:00 PM', available: true },
        { time: '03:00 PM', available: true },
      ]
    },
    '2025-05-07': {
      slots: 3,
      timeSlots: [
        { time: '08:00 AM', available: true },
        { time: '09:00 AM', available: true },
        { time: '04:00 PM', available: true },
      ]
    },
    '2025-05-09': {
      slots: 2,
      timeSlots: [
        { time: '02:00 PM', available: true },
        { time: '03:00 PM', available: true },
      ]
    },
  }
};

export async function getAvailability(providerId: string, date: string): Promise<ProviderAvailability> {
  await new Promise(resolve => setTimeout(resolve, 300));

  if (providerAvailabilityMock[providerId]) {
    if (providerAvailabilityMock[providerId][date]) {
      return { [date]: providerAvailabilityMock[providerId][date] };
    }
    
    return { 
      [date]: { 
        slots: 0, 
        timeSlots: [] 
      } 
    };
  }

  return {};
}

export async function getMonthAvailability(providerId: string, year: number, month: number): Promise<ProviderAvailability> {
  await new Promise(resolve => setTimeout(resolve, 500));

  if (providerAvailabilityMock[providerId]) {
    const result: ProviderAvailability = {};
    
    for (const dateStr in providerAvailabilityMock[providerId]) {
      const date = new Date(dateStr);
      
      if (date.getFullYear() === year && date.getMonth() === month - 1) {
        result[dateStr] = providerAvailabilityMock[providerId][dateStr];
      }
    }
    
    return result;
  }

  return {};
}

export async function bookAppointment(providerId: string, date: string, time: string): Promise<{ success: boolean, message?: string }> {
  await new Promise(resolve => setTimeout(resolve, 800));

  if (!providerAvailabilityMock[providerId] || !providerAvailabilityMock[providerId][date]) {
    return { success: false, message: 'No availability for this provider on the selected date' };
  }

  const timeSlot = providerAvailabilityMock[providerId][date].timeSlots.find(slot => slot.time === time);
  
  if (!timeSlot) {
    return { success: false, message: 'Selected time slot not found' };
  }

  if (!timeSlot.available) {
    return { success: false, message: 'This time slot is no longer available' };
  }

  timeSlot.available = false;
  providerAvailabilityMock[providerId][date].slots -= 1;

  return { success: true, message: 'Appointment booked successfully' };
}