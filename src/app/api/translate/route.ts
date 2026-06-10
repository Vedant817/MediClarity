import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { aiModelConfig } from "@/lib/ai/model-config";
import { buildTranslationPrompt } from "@/lib/ai/prompts";
import { normalizeReportText, normalizeTargetLanguage } from "@/lib/ai/validation";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const text = normalizeReportText(body.text);
        const targetLang = normalizeTargetLanguage(body.targetLang);

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: aiModelConfig.translationModel });
        const result = await model.generateContent(buildTranslationPrompt(text, targetLang));
        const response = result.response;
        const translatedText = response.text();
        
        return NextResponse.json({ translatedText }, { status: 200 });
    } catch (error) {
        console.error("Translation Error:", error);
        return NextResponse.json({ error: "Failed to translate" }, { status: 500 });
    }
}