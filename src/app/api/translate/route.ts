import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const translationPrompt = (text: string, targetLang: string) => `
You are a medical translation assistant.

Your task is to strictly translate the following medical summary into **${targetLang}**, with **NO commentary, no extra formatting, and no additional explanations**.

⚠️ Only return the translated text, nothing else.

Original summary:
"""${text}"""
`;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, targetLang } = body;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent(translationPrompt(text, targetLang));
        const response = result.response;
        const translatedText = response.text();
        
        return NextResponse.json({ translatedText }, { status: 200 });
    } catch (error) {
        console.error("Translation Error:", error);
        return NextResponse.json({ error: "Failed to translate" }, { status: 500 });
    }
}