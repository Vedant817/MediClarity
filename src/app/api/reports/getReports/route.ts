import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";

export async function POST(req: Request) {
    await connectDB();

    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reports = await Report.find({ userId }).sort({ createdAt: -1 });
        return NextResponse.json({ reports });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }
}