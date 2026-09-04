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
] as const;

export const appointmentTypeIds = appointmentTypes.map((type) => type.id) as [string, ...string[]];
