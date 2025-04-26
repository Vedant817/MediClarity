import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";

export async function GET(req: NextRequest) {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const report = await Report.findOne({ userId }).sort({ createdAt: -1 });

        if (!report) {
            return NextResponse.json({ error: "No report found" }, { status: 404 });
        }

        return NextResponse.json({
            summary: report.summary,
            ocr: report.ocr,
        });
    } catch (error) {
        console.error("Error fetching user report:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}