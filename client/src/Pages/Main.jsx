import React from 'react'
import './Main.css'
import Navbar from '../Components/Navbar.jsx';
import Footer from '../Components/Footer.jsx';

const Main = () => {
  "use strict";
function dragNdrop(event) {
    var fileName = URL.createObjectURL(event.target.files[0]);
    var preview = document.getElementById("preview");
    var previewImg = document.createElement("img");
    previewImg.setAttribute("src", fileName);
    preview.innerHTML = "";
    preview.appendChild(previewImg);
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
      
      <div class="uploadOuter">
     <label for="uploadFile" class="btn btn-primary">Upload Image</label>
      <strong>OR</strong>
      <span class="dragBox" >
      Drag and Drop image here
      <input type="file" onChange={dragNdrop}  ondragover={drag} ondrop={drop} id="uploadFile"  />
      </span>
      </div>

      <div class="category-name"></div> <br/>
            
        <div class="card-category-1">
            
            <div class="basic-card basic-card-aqua">
                <div class="card-content">
                    <span class="card-title">Card Title</span>
                    <p class="card-text">
                        Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.
                    </p>
                </div>

                <div class="card-link">
                    <a href="#" title="Read Full"><span>Read Full</span></a>
                </div>
            </div>
            </div>
     <div id="preview"></div>
    </div>

    
  )
}

export default Main