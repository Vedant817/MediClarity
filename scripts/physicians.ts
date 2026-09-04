import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Provider from '@/models/provider';

export const providersData = [
  {
    id: 'dr-smith',
    name: 'Dr. Sarah Smith',
    specialty: 'Cardiology',
    subspecialties: ['Interventional Cardiology', 'Heart Failure'],
    languages: ['English', 'Spanish'],
    gender: 'female',
    experience: 15,
    rating: 4.8,
    acceptingNewPatients: true,
    insuranceAccepted: ['Blue Cross', 'Aetna', 'Medicare'],
    hospital: 'City Medical Center',
    weeklyAvailability: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, slots: ['09:00', '10:00', '11:00', '14:00', '15:00'] }))
  },
  {
    id: 'dr-johnson',
    name: 'Dr. Michael Johnson',
    specialty: 'Family Medicine',
    subspecialties: ['Geriatrics', 'Preventive Medicine'],
    languages: ['English'],
    gender: 'male',
    experience: 10,
    rating: 4.5,
    acceptingNewPatients: true,
    insuranceAccepted: ['Blue Cross', 'United Healthcare', 'Medicare', 'Medicaid'],
    hospital: 'Valley General Hospital',
    weeklyAvailability: [1, 3, 5].map((weekday) => ({ weekday, slots: ['08:30', '09:30', '10:30', '13:30'] }))
  },
  {
    id: 'dr-williams',
    name: 'Dr. James Williams',
    specialty: 'Neurology',
    subspecialties: ['Movement Disorders', 'Epilepsy'],
    languages: ['English', 'French'],
    gender: 'male',
    experience: 20,
    rating: 4.9,
    acceptingNewPatients: true,
    insuranceAccepted: ['Aetna', 'Cigna', 'Medicare'],
    hospital: 'University Medical Center',
    weeklyAvailability: [2, 4].map((weekday) => ({ weekday, slots: ['10:00', '11:00', '15:00', '16:00'] }))
  },
  {
    id: 'dr-davis',
    name: 'Dr. Emily Davis',
    specialty: 'Endocrinology',
    subspecialties: ['Diabetes', 'Thyroid Disorders'],
    languages: ['English', 'Mandarin'],
    gender: 'female',
    experience: 8,
    rating: 4.7,
    acceptingNewPatients: true,
    insuranceAccepted: ['Blue Cross', 'Aetna', 'United Healthcare'],
    hospital: 'City Medical Center',
    weeklyAvailability: [1, 2, 4].map((weekday) => ({ weekday, slots: ['09:00', '10:00', '13:00', '14:00'] }))
  },
  {
    id: 'dr-miller',
    name: 'Dr. Robert Miller',
    specialty: 'Orthopedics',
    subspecialties: ['Sports Medicine', 'Joint Replacement'],
    languages: ['English'],
    gender: 'male',
    experience: 12,
    rating: 4.6,
    acceptingNewPatients: false,
    insuranceAccepted: ['Blue Cross', 'Medicare', 'Workers Comp'],
    hospital: 'Sports Medicine Institute',
    weeklyAvailability: []
  },
];

export async function seedDevelopmentProviders() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEVELOPMENT_FIXTURES !== 'true') {
    throw new Error('Development provider fixtures require ALLOW_DEVELOPMENT_FIXTURES=true and are forbidden in production');
  }
  await connectDB();

  try {
    await Provider.bulkWrite(providersData.map((provider) => ({
      updateOne: {
        filter: { id: provider.id },
        update: { $set: provider },
        upsert: true,
      },
    })));
    console.log('Development provider fixtures upserted');

  } catch (error) {
    console.error('Error seeding providers:', error);
  } finally {
    await mongoose.connection.close();
  }
}

const isDirectExecution = (() => {
  const entry = process.argv[1]?.replace(/\\/g, "/");
  return Boolean(entry && (entry.endsWith("scripts/physicians.ts") || entry.endsWith("scripts/physicians.js")));
})();

if (isDirectExecution) {
  void seedDevelopmentProviders();
}
