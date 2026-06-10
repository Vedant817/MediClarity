import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { aiModelConfig } from "@/lib/ai/model-config";
import { buildSummaryPrompt } from "@/lib/ai/prompts";
import { normalizeReportText } from "@/lib/ai/validation";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const text = normalizeReportText(body.text);

        if (!text) {
            return NextResponse.json({ error: "Report text is required" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: aiModelConfig.summaryModel });
        const result = await model.generateContent(buildSummaryPrompt(text));
        const response = await result.response;
        const summary = response.text();

        return NextResponse.json({ summary });
    } catch (err) {
        console.error("Summary Error:", err);
        return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
    }
}