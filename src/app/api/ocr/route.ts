import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runOcrFromImageUrl, runOcrFromPdfUrl } from "@/lib/ocr";
import { isAllowedCloudinaryDocumentUrl } from "@/lib/security/document-url";

interface OCRPage {
    index: number;
    markdown: string;
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { documentUrl } = await request.json();

        if (!isAllowedCloudinaryDocumentUrl(documentUrl, userId)) {
            return NextResponse.json({ error: "Document URL is not allowed" }, { status: 400 });
        }

        const isPdf = new URL(documentUrl).pathname.toLowerCase().endsWith(".pdf");

        const result = isPdf
            ? await runOcrFromPdfUrl(documentUrl)
            : await runOcrFromImageUrl(documentUrl);

        const extractedText = result?.pages?.map((page: OCRPage) => {
            return {
                pageIndex: page.index,
                text: page.markdown,
            };
        });
        return NextResponse.json({ extractedText: extractedText || [] });

    } catch (error) {
        console.error("OCR processing failed:", error);
        return NextResponse.json(
            { error: "Failed to process document" },
            { status: 500 }
        );
    }
}
