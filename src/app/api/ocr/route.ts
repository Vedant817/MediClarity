import { NextRequest, NextResponse } from 'next/server';
import { runOcrFromImageUrl, runOcrFromPdfUrl } from '@/lib/ocr';

interface OCRPage {
    index: number;
    markdown: string;
}

export async function POST(request: NextRequest) {
    try {
        const { documentUrl } = await request.json();

        if (!documentUrl) {
            return NextResponse.json({ error: 'Document URL is required' }, { status: 400 });
        }

        const isPdf = documentUrl.toLowerCase().endsWith('.pdf');

        let result;
        if (isPdf) {
            result = await runOcrFromPdfUrl(documentUrl);
        } else {
            result = await runOcrFromImageUrl(documentUrl);
        }

        const extractedText = result?.pages?.map((page: OCRPage) => {
            return {
                pageIndex: page.index,
                text: page.markdown,
            };
        });
        return NextResponse.json({ extractedText: extractedText || [] });

    } catch (error: Error | unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Failed to process document', details: errorMessage },
            { status: 500 }
        );
    }
}