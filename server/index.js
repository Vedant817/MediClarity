import express from 'express'
import { Resend } from 'resend'
import cors from 'cors'
import dotenv from 'dotenv'
import { PDFExtract } from 'pdf.js-extract'
import * as fs from 'fs/promises';
import path from 'path';
import upload from './middlewares/multer.middleware.js'
dotenv.config();

const app = express();
const pdfExtract = new PDFExtract();
app.use(cors({
    origin: 'http://localhost:3000'
}));
app.use(express.json());
// app.use('/api/upload-file', express.raw({ type: 'application/pdf', limit: '10mb' }));

const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/api/send-email', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const { data, error } = await resend.emails.send({
            from: 'Your Company <noreply@yourcompany.com>',
            to: email,
            subject: 'Thank you for contacting MediClarity',
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Thank you for contacting MediClarity</title>
            </head>
            <body>
                <div>
                    <h1>Thank You for Contacting MediClarity</h1>
                    <p>Dear ${name},</p>
                    <p>Thank you for reaching out to MediClarity. We have received your message and appreciate you taking the time to contact us.</p>
                    <p>Our team is reviewing your inquiry and we will get back to you as soon as possible.</p>
                    <p>Best regards,</p>
                    <p>The MediClarity Team</p>
                </div>
            </body>
            </html>
        `
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.status(200).json({ message: 'Email sent successfully', data });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while sending the email' });
    }
});

app.post('/api/upload-file', (req, res, next) => {
    console.log('Headers: ', req.headers);
    console.log('Request Body: ', req.body)
    next()
}, upload.single('file'), async (req, res) => {
    try {
        console.log(req)
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filepath = req.file.path;
        console.log(filepath)

        try {
            const data = await pdfExtract.extract(filepath, {});
            //? Delete the temporary file
            await fs.unlink(filepath);
            res.status(200).json(data);
        } catch (extractError) {
            console.error(extractError);
            try {
                await fs.unlink(filepath);
            } catch (unlinkError) {
                console.error('Failed to delete the temporary file.', unlinkError);
            }
        }
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while uploading the file' });
    }
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));