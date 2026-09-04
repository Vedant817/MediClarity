import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY!;
const client = new Mistral({ apiKey });

function ocrModel(): string {
    const configured = process.env.MISTRAL_OCR_MODEL?.trim();
    if (configured) return configured;
    if (process.env.NODE_ENV !== "production") return "mistral-ocr-latest";
    throw new Error("MISTRAL_OCR_MODEL must be configured in production");
}

export async function runOcrFromImageUrl(imageUrl: string) {
    const ocrResponse = await client.ocr.process({
        model: ocrModel(),
        document: {
            type: "image_url",
            imageUrl,
        },
    });

    return ocrResponse;
}

export async function runOcrFromPdfUrl(pdfUrl: string) {
    const uploadedPdf = await client.ocr.process({
        model: ocrModel(),
        document: {
            type: "document_url",
            documentUrl: pdfUrl,
        }
    })
    return uploadedPdf;
}
