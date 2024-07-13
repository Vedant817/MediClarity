import React from 'react';
import Navbar from '../Components/Navbar';
import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="w-full h-screen my-2">
      <Navbar />
      <main className="flex items-center justify-between p-6 m-4 h-4/5">
        <div className="w-1/2">
          <div className='text-6xl font-bold my-2'>
            <h1>Get Quick</h1>
            <h1>Medical Service</h1>
          </div>
          <div className='py-2 mb-2'>
            <p className='text-2xl'>
              In today's fast-paced world, access to prompt and efficient medical
              services is of paramount importance. When faced with a medical
              emergency or seeking immediate medical attention, the ability to
              receive quick medical services can significantly impact the outcome
              of a situation.
            </p>
          </div>
          <div className='bg-[#1a876a] w-1/3 rounded-2xl'>
            <button className="bg-[#28bf96] w-full text-center font-semibold text-lg p-3 rounded-2xl hover:bg-[hsl(164,50%,27%)]">
              <Link to='/main'>Try Now</Link>
            </button>
          </div>
        </div>
        <div className="w-1/2 h-full relative">
          <img src="https://cdn.pixabay.com/photo/2017/01/31/22/32/doctor-2027768_640.png" alt="header" className='absolute inset-0 w-full h-full object-contain' />
        </div>
      </main>
    </div>
  );
}

export default Landing;
