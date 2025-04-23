import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {

    const { userId } = await auth()

    if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
    }
    await connectDB();

    try {
        const { fileUrl, summary } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const report = await Report.create({ userId, fileUrl, summary });
        return NextResponse.json({ message: "Report saved", report });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }
}