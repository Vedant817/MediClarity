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
      Darg and Drop image here
      <input type="file" onChange={dragNdrop}  ondragover={drag} ondrop={drop} id="uploadFile"  />
      </span>
      </div>
     <div id="preview"></div>

    </div>
  )
}

export default Main