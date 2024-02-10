import React, { useState } from 'react';
import './Main.css';
import Navbar from '../Components/Navbar.jsx';
import Footer from '../Components/Footer.jsx';
import Tesseract from 'tesseract.js';
import axios from 'axios'

const Main = () => {
    const [extractedText, setExtractedText] = useState('');
    const [image, setimage] = useState('')

    

      const Summary = async()=>{
        try {
            let response = await fetch('http://localhost:3000/textfile',{
            method:'POST',
        });

        if(!response.ok){
            throw new Error('Failed')
        }

        return response.text();
           
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image.');
          }
    
      }

      const displayResponse = async () => {
        try {
            const summary = await Summary();
            const divElement = document.getElementById('preview');
            divElement.innerHTML = summary;
        } catch (error) {
            console.error('Error displaying response:', error);
            // Handle error if needed
        }
    }


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


    async function uploadImage() {
        const fileInput = document.getElementById('uploadFile');
        const file = fileInput.files[0];
  
        if (!file) {
          alert('Please select an image file.');
          return;
        }
  
        const formData = new FormData();
        formData.append('image', file);
  
        try {
          const response = await fetch('http://localhost:3000/upload_image', {
            method: 'POST',
            body: formData
          });
  
          if (!response.ok) {
            throw new Error('Upload failed');
          }
          alert('Image uploaded successfully!');
          displayResponse();
         
        } catch (error) {
          console.error('Error uploading image:', error);
          alert('Failed to upload image.');
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
                <input type="file" name='image'  onDragOver={drag} onDrop={drop} onChange={uploadImage} id="uploadFile"  />
                </span>
            </div>

            <div className="category-name"></div> 

            <div className='big-card'>
                {/* <div className="card-category-1">
                        
                        <div className="basic-card basic-card-aqua">
                            <div className="card-content">
                                <span className="card-title">Upload Image</span>
                                <br/>
                                <p className="card-text"><div id="preview"></div></p> {/* Render extracted text here */}
                            {/* </div>
        
                                <div className="card-link">
                                    <a href="#" title="Read Full"><span></span></a>
                                </div>
                            </div>
        
                            
                        </div>
         */} 
                        <div className="card-category-1">
                                
                        <div className="basic-card basic-card-aqua">
                            <div className="card-content">
                                <span className="card-title">Extracted Text</span>
                                <br/>
                                <p className="card-text"><div id="preview"></div></p> {/* Render extracted text here */}
                            </div>
        
                                <div className="card-link">
                                    <a href="#" title="Read Full"><span></span></a>
                                </div>
                            </div>
        
                            
                        </div></div>  
            
            
        </div>
    );
}

export default Main;
