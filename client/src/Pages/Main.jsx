import React, { useState } from 'react';
import './Main.css';
import Navbar from '../Components/Navbar.jsx';
import Footer from '../Components/Footer.jsx';
import Tesseract from 'tesseract.js';

const Main = () => {
    const [extractedText, setExtractedText] = useState('');

    function uploadImage(event) {
        const file = event.target.files[0];

        if (!file) {
          alert('Please select an image file.');
          return;
        }

        // Perform OCR on the image
        Tesseract.recognize(
            file,
            'eng', // Specify language ('eng' for English)
            { logger: m => console.log(m) } // Log recognition progress to the console
        ).then(({ data: { text } }) => {
            console.log('Extracted text:', text); // Log the extracted text to the console
            setExtractedText(text); // Set the extracted text in state
        }).catch(error => {
            console.error('Error performing OCR:', error);
            alert('Failed to perform OCR.');
        });
    }

    return (
        <div>
            <Navbar/>
            <Footer/>
            
            <div className="uploadOuter">
                <label htmlFor="uploadFile" className="btn btn-primary">Upload Image</label>
                <strong>OR</strong>
                <span className="dragBox" >
                Drag and Drop image here
                <input type="file" name='image' onChange={uploadImage} id="uploadFile"  />
                </span>
            </div>

            <div className="category-name"></div> <br/>
                    
            <div className="card-container">
                <div className="card-category-1">
                    <div className="basic-card basic-card-aqua">
                        <div className="card-content">
                            <span className="card-title"></span>
                            <p className="card-text"><div id="preview"></div></p> {/* Render extracted text here */}
                        </div>
                        <div className="card-link">
                            <a href="#" title="Read Full"><span></span></a>
                        </div>
                    </div>
                </div>

                <div className="card-category-1">
                    <div className="basic-card basic-card-aqua">
                        <div className="card-content">
                            <span className="card-title"></span>
                            <p className="card-text">{extractedText}</p> {/* Render extracted text here */}
                        </div>
                        <div className="card-link">
                            <a href="#" title="Read Full"><span></span></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Main;
