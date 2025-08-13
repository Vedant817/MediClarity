import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    providerId: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    reason: { type: String, required: true },
    preVisitRequirements: { type: [String], default: [] },
    status: { type: String, default: 'scheduled' },
    createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.models.Appointment ||
    mongoose.model('Appointment', AppointmentSchema);

export default Appointment;
