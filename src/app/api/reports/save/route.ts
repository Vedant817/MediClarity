import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import { normalizeReportText } from "@/lib/ai/validation";
import { isAllowedCloudinaryDocumentUrl } from "@/lib/security/document-url";

export async function POST(req: Request) {
    const { userId } = await auth();

    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    await connectDB();

    try {
        const body = await req.json();
        const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : "";
        const summary = normalizeReportText(body.summary);
        const ocr = normalizeReportText(body.ocr);

        if (!isAllowedCloudinaryDocumentUrl(fileUrl, userId) || !summary || !ocr) {
            return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
        }

        const report = await Report.create({ userId, fileUrl, summary, ocr });
        return NextResponse.json({ message: "Report saved", report });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }
}
