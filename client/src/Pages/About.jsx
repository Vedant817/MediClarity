import React from 'react'
import Navbar from '../Components/Navbar'

const About = () => {
  const features = [
    {
      content: "Providing patients with simplified explanations of their medical records."
    },
    {
      content: "Offering healthcare professionals concise summaries of complex cases."
    },
    {
      content: "Delivering explanatory content to the general public."
    }
  ]
  return (
    <div className='min-h-screen w-full flex flex-col'>
      <Navbar />
      <div className="flex-grow flex items-center justify-evenly p-8">
        <div className="w-2/5 max-w-lg">
          <img
            src="https://raw.githubusercontent.com/pico-india/main-django/main/static/about-team.jpg"
            alt="About"
            className='w-full h-auto rounded-xl shadow-2xl shadow-slate-700'
          />
        </div>
        <div className="w-2/5 space-y-4">
          <h2 className='text-4xl font-bold text-[#28bf96]'>
            MEDICLARITY <span className="text-white">FOR EVERYONE</span>
          </h2>
          <p className='text-xl text-white leading-relaxed'>
            <b className='text-yellow-300'>MediClarity</b> is a medical website that summarizes medical reports, serving various purposes such as:
          </p>
          <ul className='list-disc list-inside text-white text-base space-y-2'>
            {features.map((feature) => (
              <li className='text-lg'>
                <span>{feature.content}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default About