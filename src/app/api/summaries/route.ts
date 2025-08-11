import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const patientFriendlyPrompt = (text: string) => `
You are a compassionate medical assistant. Your task is to summarize the following medical report for a patient who has no medical background.

**Please explain everything in simple, easy-to-understand language.** Avoid medical jargon as much as possible. If you must use a medical term, please explain it immediately in a simple way.

The summary should be structured as follows:

**1. What was this report for?**
   - Briefly explain the reason for the test or visit in one or two simple sentences.

**2. What were the main findings?**
   - Summarize the key results from the report.
   - If there are any measurements or numbers, explain what they mean in a simple way (e.g., "Your blood pressure was a little high, which is like the pressure in your water pipes being a bit strong.").
   - Use analogies and simple comparisons to help understanding.

**3. What do these findings mean for my health?**
   - Explain the implications of the findings in a clear and reassuring way.
   - If everything is normal, state that clearly.
   - If there are any areas of concern, explain what they are and what the next steps might be, without causing unnecessary alarm.

**4. Key takeaways:**
   - Provide a few bullet points that summarize the most important information from the report.

Here is the report content:

"${text}"
`;


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text } = body;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(patientFriendlyPrompt(text));
        const response = await result.response;
        const summary = response.text();

        return NextResponse.json({ summary });
    } catch (err) {
        console.error("Summary Error:", err);
        return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
    }
}