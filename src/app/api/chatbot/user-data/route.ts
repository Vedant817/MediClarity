import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectDB();
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
