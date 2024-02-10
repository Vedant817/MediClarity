import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';
import { exec } from 'child_process';

dotenv.config({
    path: './.env'
});

const port = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.get('/run-python', (req, res) => {
            const comm = 'python C:\\Users\\vedan\\Downloads\\MediClarity\\image_detection\\Keyword_generator.py'
            const command = 'python C:\\Users\\vedan\\Downloads\\MediClarity\\image_detection\\Report_generator.py'
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing Python script: ${error.message}`);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                console.log(`Python script output: ${ stdout }`);
                res.status(200).send(stdout);
            })
        })
        app.listen(port, () => {
            console.log(`Server Running at port: ${port}`);
        })
    })
    .catch((err) => {
        console.log('MongoDB connection Failed!!', err);
    })