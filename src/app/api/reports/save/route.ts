import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
    const { userId } = await auth();

    if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    await connectDB();

    try {
        const { fileUrl, summary, ocr } = await req.json();

        if (!fileUrl || !summary || !ocr) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const report = await Report.create({ userId, fileUrl, summary, ocr });
        return NextResponse.json({ message: "Report saved", report });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }
}