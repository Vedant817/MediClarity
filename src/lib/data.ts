export type MedicalEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
  status?: string;
};

export type Medication = {
  id: string;
  date: string;
  title: string;
  description: string;
  status?: string;
};

export type Appointment = {
  id: string;
  date: string;
  title: string;
  description: string;
  status?: string;
};

export const appointmentTypes = [
  {
    id: 'check-up',
    name: 'Check-up',
    description: 'Regular health examination'
  },
  {
    id: 'follow-up',
    name: 'Follow-up',
    description: 'Follow-up on previous visit'
  },
  {
    id: 'consultation',
    name: 'Consultation',
    description: 'Discuss specific health concerns'
  },
  {
    id: 'procedure',
    name: 'Procedure',
    description: 'Medical procedure or treatment'
  },
  {
    id: 'lab-work',
    name: 'Lab Work',
    description: 'Blood tests or other laboratory tests'
  },
  {
    id: 'specialist',
    name: 'Specialist Visit',
    description: 'Visit with a medical specialist'
  }
];

export const timeSlots = [
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" }
];

export const Doctors = [
  { id: "dr-smith", name: "Dr. Smith", specialty: "Primary Care" },
  { id: "dr-johnson", name: "Dr. Johnson", specialty: "Cardiology" },
  { id: "dr-williams", name: "Dr. Williams", specialty: "Neurology" }
];