import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Tesseract from 'tesseract.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

let uploadCount = 0;

const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,'Images/')
    },
    filename:(req,file,cb) =>{
      uploadCount++;
      console.log(file);
      cb(null,'myfile.png');
    }
})

const upload = multer({storage:storage});



const app = express();

app.use(cors({
    origin: 'http://localhost:3001'
}))

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(cookieParser())

import userRouter from './routes/user.route.js'
app.use('/api/v1/users', userRouter)

app.post("/upload_image",upload.single("image"),(req,res)=>{
    try {
        if (!req.file) {
          return res.status(400).send('No files were uploaded.');
        }
    
        // File has been uploaded successfully
        console.log('File uploaded:', req.file);
        res.send('File uploaded successfully!');
      } catch (error) {
        console.error('Upload error:', error);
        res.status(500).send('Upload failed.');
      }
})

app.get('/textfile', (req, res) => {
  fs.readFile('./ConvertedText/text.txt', 'utf8', (err, data) => {
      if (err) {
          res.status(500).send('Error reading the file');
          return;
      }
      res.send(data);
  });
});

export {app};