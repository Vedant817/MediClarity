import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const reports = await Report.find({ userId })
            .select({ fileUrl: 1, summary: 1, createdAt: 1, updatedAt: 1, labResults: 1 })
            .sort({ createdAt: -1 })
            .lean();
        return NextResponse.json({ reports });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }
}
