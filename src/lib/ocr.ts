import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY!;
const client = new Mistral({ apiKey });

export async function runOcrFromImageUrl(imageUrl: string) {
    const ocrResponse = await client.ocr.process({
        model: "mistral-ocr-latest",
        document: {
            type: "image_url",
            imageUrl,
        },
    });

    return ocrResponse;
}

export async function runOcrFromPdfUrl(pdfUrl: string) {
    const uploadedPdf = await client.ocr.process({
        model: "mistral-ocr-latest",
        document: {
            type: "document_url",
            documentUrl: pdfUrl,
        }
    })
    return uploadedPdf;
}