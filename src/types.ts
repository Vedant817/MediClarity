export interface MedicalReport {
  id: string;
  userId: string;
  fileUrl: string;
  summary: string;
  ocr?: string;
  createdAt: string;
}

export interface AppointmentRecommendation {
  id:string;
  specialistType: string;
  urgency: 'low' | 'medium' | 'high';
  relatedConditions: string[];
  recommendedTimeframe: string;
}

export interface Provider {
  id: string;
  name: string;
  specialty: string;
  availability: {
    date: string;
    slots: string[];
  }[];
  location: string;
  rating: number;
  imageUrl?: string;
}

export interface AppointmentRequest {
  userId: string;
  specialtyNeeded?: string;
  providerId?: string;
  preferredDates?: string[];
  reason?: string;
  urgency?: string;
}

export interface BookingData {
        providerName?: string;
    providerId?: string;
    date?: string;
    time?: string;
    reason?: string;
    type?: string;
}

export interface Doctor {
    id: string;
    name: string;
    specialty: string;
    justification: string;
}


export interface PatientProfile {
  age: number;
  gender: 'male' | 'female' | 'other';
  primaryConcerns: string[];
  communicationPreferences: {
    preferredLanguage: string;
    receivesUpdates: boolean;
  };
}

export interface TimelineEvent {
    id: string;
    date: string;
    title: string;
    description: string;
    status?: string;
    type: 'medical' | 'medication' | 'appointment';
    providerId?: string;
}
