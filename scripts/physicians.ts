import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Provider from '@/models/provider';

const providersData = [
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
    hospital: 'City Medical Center'
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
    hospital: 'Valley General Hospital'
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
    hospital: 'University Medical Center'
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
    hospital: 'City Medical Center'
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
    hospital: 'Sports Medicine Institute'
  },
];

async function seedProviders() {
  await connectDB();

  try {
    await Provider.deleteMany({});
    console.log('Providers cleared');

    await Provider.insertMany(providersData);
    console.log('Providers seeded');

  } catch (error) {
    console.error('Error seeding providers:', error);
  } finally {
    await mongoose.connection.close();
  }
}

seedProviders();
