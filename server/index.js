import express from 'express'
import { Resend } from 'resend'
import cors from 'cors'
import dotenv from 'dotenv'
import { PDFExtract } from 'pdf.js-extract'
import * as fs from 'fs/promises';
import upload from './middlewares/multer.middleware.js'
import { GoogleGenAI } from '@google/genai'
dotenv.config();

const app = express();
const pdfExtract = new PDFExtract();
app.use(cors({
    origin: 'http://localhost:3000'
}));
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const prompt = `You are an AI assistant specializing in medical report interpretation. Your task is to analyze an array of keywords extracted from a user-uploaded medical report and provide a clear, easily understandable summary. Your response should:

1. Be tailored for individuals without medical expertise
2. Explain each key finding or test result in simple terms
3. Provide context for normal ranges and interpret values that are out of range
4. Describe potential implications or next steps for abnormal results
5. Use bullet points or numbered lists for clarity
6. Organize information into logical sections (e.g., "Blood Tests", "Imaging Results")
7. Highlight any critical or urgent findings
8. Avoid medical jargon, or explain it when necessary
9. Include a brief disclaimer about consulting a healthcare professional for personalized advice

Format your response with appropriate headers, subheaders, and spacing to enhance readability. If there are multiple related items, group them together for a more coherent explanation.

Remember, your goal is to inform and educate, not to diagnose or provide medical advice. Always encourage the user to discuss the results with their healthcare provider for a comprehensive interpretation and personalized recommendations.`;

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

app.post('/api/upload-file', async (req, res, next) => {
    next()
}, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const filepath = req.file.path;
        try {
            const data = await pdfExtract.extract(filepath, {});
            const content = data.pages[0].content
            const keywordsArray = []
            content.map((obj) => {
                const word = obj.str.trim();
                if (word != '') {
                    keywordsArray.push(word)
                }
            })
            const keywords = keywordsArray.join(', ')
            const result = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: `${prompt}\n\nKeywords: ${keywords}`
            });
            
            const response = result.text
            await fs.unlink(filepath);
            res.status(200).json({ keywords, analysis: response });
        } catch (extractError) {
            console.error('Failed to extract keywords from the PDF file.', extractError);
            try {
                await fs.unlink(filepath);
            } catch (unlinkError) {
                console.error('Failed to delete the temporary file.', unlinkError);
            }
            res.status(500).json({ error: 'Failed to process the PDF file' });
        }
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while uploading the file' });
    }
})

const PORT = process.env.PORT || 5000;
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
        });

        res.json({ text: response.text });
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: 'An error occurred while generating the content' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));