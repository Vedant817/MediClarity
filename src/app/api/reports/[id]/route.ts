import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Report from "@/models/report";
import { auth } from "@clerk/nextjs/server";
import LabResult from "@/models/labResult";
import EducationCard from "@/models/educationCard";

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const params = await context.params;
        const report = await Report.findOne({ _id: params.id, userId }).select({ ocr: 0 }).lean();

        if (!report) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const [labs, education] = await Promise.all([
            LabResult.find({ reportId: report._id, userId }).sort({ date: -1, canonicalName: 1 }).lean(),
            EducationCard.find({ reportId: report._id, userId }).sort({ createdAt: 1 }).lean(),
        ]);
        return NextResponse.json({ report: { ...report, labs, education } });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
