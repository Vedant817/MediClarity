import { auth } from "@clerk/nextjs/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextRequest, NextResponse } from "next/server";
import { getLLM, llmContentToText } from "@/lib/llm";

export const runtime = "nodejs";

const disclaimer =
  "For information only, not medical advice. A qualified clinician should interpret these results in your full clinical context.";
const supportedLanguages: Record<string, string> = {
    en: "English",
    hi: "Hindi",
    pa: "Punjabi",
    es: "Spanish",
    ar: "Arabic",
    pt: "Portuguese",
    fr: "French",
};

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { text, targetLang } = body;
        if (
            typeof text !== "string" ||
            !text.trim() ||
            text.length > 50_000 ||
            typeof targetLang !== "string" ||
            !supportedLanguages[targetLang]
        ) {
            return NextResponse.json({ error: "Invalid translation request" }, { status: 400 });
        }

        const model = getLLM("translate");
        const result = await model.invoke([
            new SystemMessage(
                "You are a careful medical translator. Translate faithfully without adding findings, diagnoses, advice, commentary, or extra formatting. Return only translated text.",
            ),
            new HumanMessage(
                `Translate the following medical summary and its safety disclaimer into ${supportedLanguages[targetLang]}.\n\nMEDICAL SUMMARY:\n${text.trim()}\n\nSAFETY DISCLAIMER:\n${disclaimer}`,
            ),
        ]);
        const translatedText = llmContentToText(result.content).trim();
        if (!translatedText) {
            throw new Error("AI provider returned an empty translation");
        }
        
        return NextResponse.json({ translatedText }, { status: 200 });
    } catch (error) {
        console.error("Translation Error:", error);
        return NextResponse.json({ error: "Failed to translate" }, { status: 500 });
    }
}
