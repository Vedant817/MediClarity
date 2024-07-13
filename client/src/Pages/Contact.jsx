import React from "react";
import Navbar from "../Components/Navbar";

const Contact = () => {
  return (
    <div className="min-h-screen w-full flex flex-col">
      <Navbar />
      <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-[#28bf96]">Get in Touch</h1>
          <p className="text-xl">We'd love to hear from you. Please fill out this form.</p>
        </div>
        <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl p-8">
          <form className="space-y-6">
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Name:</label>
              <input className="h-12 rounded-lg border-2 border-gray-300 px-4 focus:outline-none focus:border-[#28bf96]" />
            </div>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Email:</label>
              <input type="email" className="h-12 rounded-lg border-2 border-gray-300 px-4 focus:outline-none focus:border-[#28bf96]" />
            </div>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Phone:</label>
              <input type="tel" className="h-12 rounded-lg border-2 border-gray-300 px-4 focus:outline-none focus:border-[#28bf96]" />
            </div>
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-gray-700 mb-1">Message:</label>
              <textarea className="h-32 rounded-lg border-2 border-gray-300 p-4 focus:outline-none focus:border-[#28bf96]" />
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