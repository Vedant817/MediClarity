import React, { useState } from "react";
import Navbar from "../Components/Navbar";

const Contact = () => {
  const formInitialDetails = {
    name: '',
    email: '',
    phone: '',
    message: ''
  }

  const [formDetails, setFormDetails] = useState(formInitialDetails);

  const onFormUpdate = (category, value) => {
    setFormDetails({
      ...formDetails,
      [category]: value
    })
  }

  const sendEmail = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formDetails),
      });
      const data = await response.json();
      if (response.ok) {
        console.log('Email sent successfully', data);
      } else {
        console.error('Failed to send email', data.error);
      }
    } catch (error) {
      console.error('An error occurred', error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col">
      <Navbar />
      <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-[#28bf96]">Get in Touch</h1>
          <p className="text-xl">We'd love to hear from you. Please fill out this form.</p>
        </div>
        <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl p-8">
          <form className="space-y-6" onSubmit={sendEmail}>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Name:</label>
              <input className="text-black h-12 rounded-lg border-2 border-gray-300 px-4 focus:outline-none focus:border-[#28bf96]" value={formDetails.name} onChange={(e) => onFormUpdate('name', e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Email:</label>
              <input type="email" className="text-black h-12 rounded-lg border-2 border-gray-300 px-4 focus:outline-none focus:border-[#28bf96]" value={formDetails.email} onChange={(e) => onFormUpdate('email', e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Phone:</label>
              <input type="tel" className="text-black h-12 rounded-lg border-2 border-gray-300 px-4 focus:outline-none focus:border-[#28bf96]" value={formDetails.phone} onChange={(e) => onFormUpdate('phone', e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Message:</label>
              <textarea className="text-black h-32 rounded-lg border-2 border-gray-300 p-4 focus:outline-none focus:border-[#28bf96]" value={formDetails.message} onChange={(e) => onFormUpdate('message', e.target.value)} />
            </div>
            <div className="flex justify-center">
              <button type="submit" className="bg-[#28bf96] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#1a876a] transition duration-300">
                Send Message
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;