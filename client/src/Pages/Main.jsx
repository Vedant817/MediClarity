/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Navbar from '../Components/Navbar';
import html2pdf from 'html2pdf.js';
import showdown from 'showdown';

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

    const downloadPDF = () => {
        const rawMarkdown = result?.analysis;
    
        if (!rawMarkdown) {
            alert("No content to export!");
            return;
        }
    
        // Convert Markdown to HTML
        const converter = new showdown.Converter(); // <-- make sure to import showdown
        const htmlContent = converter.makeHtml(rawMarkdown);
    
        // Create printable element
        const element = document.createElement('div');
        element.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                <h1 style="color: #28bf96; text-align: center; margin-bottom: 30px;">Test PDF</h1>
                ${htmlContent}
            </div>
        `;
        document.body.appendChild(element);
    
        const opt = {
            margin: 0.5,
            filename: 'medical-report-analysis.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
    
        html2pdf().set(opt).from(element).save().then(() => {
            element.remove(); // Clean up after PDF is saved
        });
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
                        <div className="flex justify-center space-x-4">
                            <button type="submit" className="bg-[#28bf96] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#1a876a] transition duration-300">Generate</button>
                            <button
                                type="button"
                                onClick={downloadPDF}
                                disabled={!result}
                                className={`font-bold py-3 px-8 rounded-lg transition duration-300 ${result ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                            >
                                Download PDF
                            </button>
                        </div>
                        {result && (
                            <>
                                <div className='mt-8 text-black'>
                                    <div className='prose prose-lg max-w-none h-96 overflow-y-auto p-4 border border-gray-300 rounded-md shadow-inner'>
                                        <ReactMarkdown>{result.analysis}</ReactMarkdown>
                                    </div>
                                </div>
                                {/* Hidden div for PDF generation with full content */}
                                <div id="result-content" className='hidden'>
                                    <div className='prose prose-lg max-w-none p-4'>
                                        <ReactMarkdown>{result.analysis}</ReactMarkdown>
                                    </div>
                                </div>
                            </>
                        )}

                    </form>
                </div>
            </div>
        </div>
    )
}

export default Main;
