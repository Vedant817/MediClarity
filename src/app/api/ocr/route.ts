import { NextRequest, NextResponse } from 'next/server';
import { runOcrFromImageUrl, runOcrFromPdfUrl } from '@/lib/ocr';
import { auth } from '@clerk/nextjs/server';
import { assertOwnedCloudinaryDocumentUrl } from '@/lib/upload-security';

export const runtime = 'nodejs';

interface OCRPage {
    index: number;
    markdown: string;
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { documentUrl } = await request.json();
        let trustedUrl: URL;
        try {
            trustedUrl = assertOwnedCloudinaryDocumentUrl(documentUrl);
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Invalid document URL' },
                { status: 400 },
            );
        }

        const isPdf = trustedUrl.pathname.toLowerCase().endsWith('.pdf');

        let result;
        if (isPdf) {
            result = await runOcrFromPdfUrl(trustedUrl.toString());
        } else {
            result = await runOcrFromImageUrl(trustedUrl.toString());
        }

        const extractedText = result?.pages?.map((page: OCRPage) => {
            return {
                pageIndex: page.index,
                text: page.markdown,
            };
        });
        return NextResponse.json({ extractedText: extractedText || [] });

    } catch (error: Error | unknown) {
        console.error('OCR processing failed:', error);
        return NextResponse.json(
            { error: 'Failed to process document' },
            { status: 500 }
        );
    }
}
