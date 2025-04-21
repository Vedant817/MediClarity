import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const strictPrompt = (text: string) => `
You are a medical document assistant. Summarize the following medical report content into clear, structured, bullet-point format.

⚠️ Be VERY STRICT in extracting only useful and meaningful medical info. NO fluff.
🩺 Focus on:
- Patient details (if any)
- Reason for medical assessment
- Site/time/events
- Consent status
- Observers
- Presenting complaint
- Sources of information
- Any clear diagnostic, procedural or treatment notes

📄 Use this strict format:

**🔹 Patient Details**
- Name: ...
- DOB: ...
- Hospital #: ...

**🔹 Reason for Medical Assessment**
- ...

**🔹 Timeline of Events**
- [Date/time] - [Event detail]

**🔹 Consent**
- ...

**🔹 Observers**
- ...

**🔹 Presenting Complaint**
- ...

**🔹 Source of Information**
- ...

Now, here is the report content:

"${text}"
`;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text } = body;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent(strictPrompt(text));
        const response = await result.response;
        const summary = response.text();

        return NextResponse.json({ summary });
    } catch (err) {
        console.error("Summary Error:", err);
        return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
    }
}
