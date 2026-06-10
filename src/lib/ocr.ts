import { Mistral } from '@mistralai/mistralai';
import { aiModelConfig } from './ai/model-config';

const apiKey = process.env.MISTRAL_API_KEY!;
const client = new Mistral({ apiKey });

export async function runOcrFromImageUrl(imageUrl: string) {
    const ocrResponse = await client.ocr.process({
        model: aiModelConfig.ocrModel,
        document: {
            type: "image_url",
            imageUrl,
        },
    });

    return ocrResponse;
}

export async function runOcrFromPdfUrl(pdfUrl: string) {
    const uploadedPdf = await client.ocr.process({
        model: aiModelConfig.ocrModel,
        document: {
            type: "document_url",
            documentUrl: pdfUrl,
        }
    })
    return uploadedPdf;
}