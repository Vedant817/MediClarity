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
