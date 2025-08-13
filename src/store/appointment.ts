import { create } from 'zustand';

type AppointmentState = {
  activeStep: number;
  selectedType: string;
  selectedDate: string;
  selectedTime: string;
  selectedProvider: string;
  setActiveStep: (step: number) => void;
  setSelectedType: (type: string) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  setSelectedProvider: (provider: string) => void;
  reset: () => void;
};

export const useAppointmentStore = create<AppointmentState>((set) => ({
  activeStep: 0,
  selectedType: '',
  selectedDate: '',
  selectedTime: '',
  selectedProvider: '',
  setActiveStep: (step) => set({ activeStep: step }),
  setSelectedType: (type) => set({ selectedType: type }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  reset: () => set({
    activeStep: 0,
    selectedType: '',
    selectedDate: '',
    selectedTime: '',
    selectedProvider: '',
  }),
}));
