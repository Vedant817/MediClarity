import React, { useState } from 'react';
import './Main.css';
import Navbar from '../Components/Navbar.jsx';
import Footer from '../Components/Footer.jsx';
import Tesseract from 'tesseract.js';

const Main = () => {
    const [extractedText, setExtractedText] = useState('');

    function dragNdrop(event) {
        const file = event.target.files[0];
        const fileName = file.name.toLowerCase();
        const fileType = fileName.substring(fileName.lastIndexOf('.') + 1);
        const allowedExtensions = ['jpg', 'jpeg', 'png'];

        // Check if the file type is allowed
        if (allowedExtensions.includes(fileType)) {
            const preview = document.getElementById("preview");
            const previewImg = document.createElement("img");
            previewImg.setAttribute("src", URL.createObjectURL(file));
            preview.innerHTML = "";
            preview.appendChild(previewImg);

            // Perform OCR on the image
            Tesseract.recognize(
                file,
                'eng', // Specify language ('eng' for English)
                { logger: m => console.log(m) } // Log recognition progress to the console
            ).then(({ data: { text } }) => {
                console.log('Extracted text:', text); // Log the extracted text to the console
                setExtractedText(text); // Set the extracted text in state
            });
        } else {
            alert("Only JPEG and PNG files are allowed!");
            // Optionally clear the input field
            event.target.value = '';
        }
    }

    function drag() {
        document.getElementById('uploadFile').parentNode.className = 'draging dragBox';
    }

    function drop() {
        document.getElementById('uploadFile').parentNode.className = 'dragBox';
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
                <input type="file" onChange={dragNdrop}  onDragOver={drag} onDrop={drop} id="uploadFile"  />
                </span>
            </div>

            <div className="category-name"></div> <br/>
                    
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
    );
}

export default Main;
