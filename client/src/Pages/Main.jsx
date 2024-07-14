import React, { useState } from 'react';
import Navbar from '../Components/Navbar';

const Main = () => {
    const [fileName, setFileName] = useState(null);
    const handleFileChange = (event) => {
        if (event.target.files[0]) {
            setFileName(event.target.files[0].name);
        } else {
            setFileName(null);
        }
    };

    const generateResponse = async () => { }

    return (
        <div className='h-screen w-full'>
            <Navbar />
            <div className='flex-grow flex flex-col items-center justify-center p-8 space-y-12'>
                <div className="text-center space-y-3">
                    <h1 className="text-4xl font-bold text-[#28bf96]">Upload your Medical Report</h1>
                    <p className="text-xl">Report should be in PDF format.</p>
                </div>
                <div className='w-full max-w-2xl bg-white shadow-lg rounded-xl p-8'>
                    <form className='space-y-6' onSubmit={generateResponse}>
                        <div className="flex flex-col">
                            <label className="text-lg font-semibold text-gray-700 mb-1">Medical Report:</label>
                            <div className="relative">
                                <input
                                    type='file'
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
                                <div className="flex items-center justify-between h-12 rounded-lg border-2 border-gray-300 px-4 bg-white text-gray-700 focus-within:border-[#28bf96] transition-colors duration-300">
                                    <span className="text-black truncate flex-grow">{fileName ? fileName : 'Choose a file'}</span>
                                    <span className="bg-[#28bf96] text-white px-4 py-2 rounded hover:bg-[#1a876a] transition-colors duration-300">Browse</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button type="submit" className="bg-[#28bf96] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#1a876a] transition duration-300">Send Message</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Main;
