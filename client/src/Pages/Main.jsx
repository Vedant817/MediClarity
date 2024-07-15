/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import Navbar from '../Components/Navbar';

const Main = () => {
    const [fileName, setFileName] = useState(null);
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);

    const handleFileChange = (event) => {
        if (event.target.files[0]) {
            setFile(event.target.files[0]);
            setFileName(event.target.files[0].name);
        } else {
            setFile(null);
            setFileName(null);
        }
    };

    const generateResponse = async (e) => {
        e.preventDefault();
        const fileInput = document.querySelector('input[type="file"]');
        const file = fileInput.files[0];

        if (!file) {
            console.error('No file selected');
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            setResult(null)
            const response = await fetch('http://localhost:5000/api/upload-file', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            console.log(data)
            if (response.ok) {
                setResult(data);
            } else {
                console.error('Unable to get the response');
            }
        } catch (error) {
            console.error('An error occurred in generating response.', error);
        }
    }

    return (
        <div className='min-h-screen w-full'>
            <Navbar />
            <div className='flex-grow flex flex-col items-center justify-center p-8 space-y-12'>
                <div className="text-center space-y-3">
                    <h1 className="text-4xl font-bold text-[#28bf96]">Upload your Medical Report</h1>
                    <p className="text-xl">Report should be in PDF format.</p>
                </div>
                <div className='w-full max-w-2xl bg-white shadow-lg rounded-xl p-8'>
                    <form className='space-y-6' onSubmit={generateResponse} encType="multipart/form-data" method='post'>
                        <div className="flex flex-col">
                            <label className="text-lg font-semibold text-gray-700 mb-1">Medical Report:</label>
                            <div className="relative">
                                <input
                                    type='file'
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileChange} name="uploaded_file" />
                                <div className="flex items-center justify-between h-12 rounded-lg border-2 border-gray-300 px-4 bg-white text-gray-700 focus-within:border-[#28bf96] transition-colors duration-300">
                                    <span className="text-black truncate flex-grow">{fileName ? fileName : 'Choose a file'}</span>
                                    <span className="bg-[#28bf96] text-white px-4 py-2 rounded hover:bg-[#1a876a] transition-colors duration-300">Browse</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button type="submit" className="bg-[#28bf96] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#1a876a] transition duration-300">Generate</button>
                        </div>
                        {result && (
                            <div className='flex justify-center text-lg text-center text-black'>
                                <p>{result}</p>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Main;
