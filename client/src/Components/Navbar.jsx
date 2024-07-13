import React from 'react'
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className='flex items-center justify-between border px-3 pb-1 rounded-2xl bg-neutral-800'>
      <div className='items-start'>
        <div className='text-5xl font-bold text-[#28bf96]'>
          <Link to='/'>MEDICLARITY</Link>
        </div>
      </div>
      <div className='flex items-center space-x-6 text-3xl font-semibold'>
        <div className='hover:text-[#28bf96]'>
          <Link to='/main'>Try Now</Link>
        </div>
        <div className='hover:text-[#28bf96]'>
          <Link to='/about'>About</Link>
        </div>
        <div className='hover:text-[#28bf96]'>
          <Link to='/contact'>Contact Us</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar