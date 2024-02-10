import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Tesseract from 'tesseract.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

let uploadCount = 0;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Images/')
  },
  filename: (req, file, cb) => {
    uploadCount++;
    console.log(file);
    cb(null, 'myfile.png');
  }
})

const upload = multer({ storage: storage });



const app = express();

app.use(cors({
  origin: 'http://localhost:3001'
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

import userRouter from './routes/user.route.js'
app.use('/api/v1/users', userRouter)

app.post("/upload_image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No files were uploaded.');
    }
    console.log('File uploaded:', req.file);
    const comm = 'python C:\\Users\\vedan\\Downloads\\MediClarity\\image_detection\\Keyword_generator.py'
    const command = 'python C:\\Users\\vedan\\Downloads\\MediClarity\\image_detection\\Report_generator.py'
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log(`Python script output: ${stdout}`);
      const result = stdout
      const folderName = 'C:\Users\vedan\Downloads\MediClarity\server\ConvertedText'
      const fileName = 'text.txt'
      const filePath = './ConvertedText/text.txt'
      fs.writeFile(filePath, result, (err) => {
        console.log('Error saving file: ', err);
        res.status(500).send('Error saving the file')
      })
      console.log('Text saved Successfully!');
      res.status(200).send('Text saved Successfully!');
    })
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

export { app };