export const VOICE_LANGUAGES = {
  "en-IN": { name: "English (India)", speaker: "ratan" },
  "hi-IN": { name: "Hindi", speaker: "shubh" },
  "pa-IN": { name: "Punjabi", speaker: "mani" },
  "bn-IN": { name: "Bengali", speaker: "rehan" },
  "ta-IN": { name: "Tamil", speaker: "ratan" },
  "te-IN": { name: "Telugu", speaker: "shubh" },
  "mr-IN": { name: "Marathi", speaker: "ratan" },
  "gu-IN": { name: "Gujarati", speaker: "ratan" },
  "kn-IN": { name: "Kannada", speaker: "shubh" },
  "ml-IN": { name: "Malayalam", speaker: "shubh" },
} as const;

export type VoiceLocale = keyof typeof VOICE_LANGUAGES;

export function isVoiceLocale(value: unknown): value is VoiceLocale {
  return typeof value === "string" && Object.hasOwn(VOICE_LANGUAGES, value);
}

export function languageName(locale: VoiceLocale): string {
  return VOICE_LANGUAGES[locale].name;
}

export function whisperLanguage(locale: VoiceLocale): string {
  return locale.slice(0, 2);
}

export function repeatFor(locale: VoiceLocale): string {
  const repeats: Record<VoiceLocale, string> = {
    "en-IN": "I didn't catch that clearly. Please say it again, a little slower.",
    "hi-IN": "मैं वह स्पष्ट रूप से नहीं सुन पाई। कृपया थोड़ा धीरे दोबारा कहें।",
    "pa-IN": "ਮੈਂ ਇਹ ਸਾਫ਼ ਨਹੀਂ ਸੁਣ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹਾ ਹੌਲੀ ਦੁਬਾਰਾ ਕਹੋ।",
    "bn-IN": "আমি সেটা পরিষ্কারভাবে শুনতে পাইনি। অনুগ্রহ করে একটু ধীরে আবার বলুন।",
    "ta-IN": "அதைத் தெளிவாகக் கேட்க முடியவில்லை. தயவுசெய்து மெதுவாக மீண்டும் சொல்லுங்கள்.",
    "te-IN": "నాకు అది స్పష్టంగా వినిపించలేదు. దయచేసి కాస్త నెమ్మదిగా మళ్లీ చెప్పండి.",
    "mr-IN": "मला ते स्पष्ट ऐकू आले नाही. कृपया थोडे हळू पुन्हा सांगा.",
    "gu-IN": "મને તે સ્પષ્ટ સંભળાયું નહીં. કૃપા કરીને થોડું ધીમે ફરી કહો.",
    "kn-IN": "ನನಗೆ ಅದು ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ನಿಧಾನವಾಗಿ ಮತ್ತೆ ಹೇಳಿ.",
    "ml-IN": "എനിക്ക് അത് വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി അല്പം പതുക്കെ വീണ്ടും പറയൂ.",
  };
  return repeats[locale];
}

export function confirmationFor(locale: VoiceLocale, heard: string): string {
  const clipped = heard.replace(/\s+/g, " ").trim().slice(0, 240);
  const confirmations: Record<VoiceLocale, string> = {
    "en-IN": `I heard: "${clipped}". Is that what you meant?`,
    "hi-IN": `मैंने यह सुना: "${clipped}"। क्या आप यही कहना चाहते थे?`,
    "pa-IN": `ਮੈਂ ਇਹ ਸੁਣਿਆ: "${clipped}"। ਕੀ ਤੁਸੀਂ ਇਹੀ ਕਹਿਣਾ ਚਾਹੁੰਦੇ ਸੀ?`,
    "bn-IN": `আমি এটি শুনেছি: "${clipped}"। আপনি কি এটাই বলতে চেয়েছিলেন?`,
    "ta-IN": `நான் இதைக் கேட்டேன்: "${clipped}". நீங்கள் இதைத்தான் சொல்ல விரும்பினீர்களா?`,
    "te-IN": `నేను ఇది విన్నాను: "${clipped}". మీరు ఇదే చెప్పాలనుకున్నారా?`,
    "mr-IN": `मी हे ऐकले: "${clipped}". तुम्ही हेच सांगायचे होते का?`,
    "gu-IN": `મેં આ સાંભળ્યું: "${clipped}". શું તમે આ જ કહેવા માંગતા હતા?`,
    "kn-IN": `ನಾನು ಇದನ್ನು ಕೇಳಿದೆ: "${clipped}". ನೀವು ಇದನ್ನೇ ಹೇಳಲು ಬಯಸಿದ್ದೀರಾ?`,
    "ml-IN": `ഞാൻ ഇത് കേട്ടു: "${clipped}". നിങ്ങൾ ഇതുതന്നെയാണോ പറയാൻ ഉദ്ദേശിച്ചത്?`,
  };
  return confirmations[locale];
}

export function greetingFor(locale: VoiceLocale, displayName?: string): string {
  const name = displayName ? ` ${displayName}` : "";
  const greetings: Record<VoiceLocale, string> = {
    "en-IN": `Hello${name}. I'm MediClarity's AI voice assistant. What would you like to discuss?`,
    "hi-IN": `नमस्ते${name}। मैं MediClarity की AI वॉइस सहायक हूँ। आप किस बारे में बात करना चाहेंगे?`,
    "pa-IN": `ਸਤ ਸ੍ਰੀ ਅਕਾਲ${name}। ਮੈਂ MediClarity ਦੀ AI ਵੌਇਸ ਸਹਾਇਕ ਹਾਂ। ਤੁਸੀਂ ਕਿਸ ਬਾਰੇ ਗੱਲ ਕਰਨਾ ਚਾਹੋਗੇ?`,
    "bn-IN": `নমস্কার${name}। আমি MediClarity-এর AI ভয়েস সহকারী। আপনি কী নিয়ে কথা বলতে চান?`,
    "ta-IN": `வணக்கம்${name}. நான் MediClarity AI குரல் உதவியாளர். நீங்கள் எதைப் பற்றி பேச விரும்புகிறீர்கள்?`,
    "te-IN": `నమస్కారం${name}. నేను MediClarity AI వాయిస్ సహాయకురాలిని. మీరు దేని గురించి మాట్లాడాలనుకుంటున్నారు?`,
    "mr-IN": `नमस्कार${name}. मी MediClarity ची AI व्हॉइस सहाय्यक आहे. तुम्हाला कशाबद्दल बोलायचे आहे?`,
    "gu-IN": `નમસ્તે${name}. હું MediClarity AI વૉઇસ સહાયક છું. તમે શેના વિશે વાત કરવા માંગો છો?`,
    "kn-IN": `ನಮಸ್ಕಾರ${name}. ನಾನು MediClarity AI ಧ್ವನಿ ಸಹಾಯಕ. ನೀವು ಯಾವುದರ ಬಗ್ಗೆ ಮಾತನಾಡಲು ಬಯಸುತ್ತೀರಿ?`,
    "ml-IN": `നമസ്കാരം${name}. ഞാൻ MediClarity AI വോയ്സ് അസിസ്റ്റന്റാണ്. നിങ്ങൾ എന്തിനെക്കുറിച്ചാണ് സംസാരിക്കാൻ ആഗ്രഹിക്കുന്നത്?`,
  };
  return greetings[locale];
}
