import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const params = await context.params;
        const report = await Report.findById(params.id);

        if (!report || report.userId !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json({ report });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
