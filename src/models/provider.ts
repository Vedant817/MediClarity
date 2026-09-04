import mongoose, { Schema } from 'mongoose';

export interface IProvider {
  _id: mongoose.Types.ObjectId;
  id: string;
  name: string;
  specialty: string;
  subspecialties: string[];
  languages: string[];
  gender: 'male' | 'female' | 'other';
  experience: number;
  rating: number;
  acceptingNewPatients: boolean;
  insuranceAccepted: string[];
  hospital: string;
  verifiedCredentials: string[];
  communicationStyle: string[];
  videoUrl: string;
  weeklyAvailability: Array<{ weekday: number; slots: string[] }>;
}

const ProviderSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  subspecialties: { type: [String], default: [] },
  languages: { type: [String], required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  experience: { type: Number, required: true },
  rating: { type: Number, required: true },
  acceptingNewPatients: { type: Boolean, default: true },
  insuranceAccepted: { type: [String], default: [] },
  hospital: { type: String, required: true },
  verifiedCredentials: { type: [String], default: [] },
  communicationStyle: { type: [String], default: [] },
  videoUrl: { type: String, default: '' },
  weeklyAvailability: {
    type: [{
      weekday: { type: Number, min: 0, max: 6, required: true },
      slots: {
        type: [String],
        validate: {
          validator: (slots: string[]) => slots.every((slot) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot)),
          message: 'Provider availability slots must use 24-hour HH:mm format',
        },
      },
    }],
    default: [],
  },
});

export default mongoose.models.Provider || mongoose.model<IProvider>('Provider', ProviderSchema);
