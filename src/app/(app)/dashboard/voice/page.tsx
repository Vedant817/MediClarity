import PatientVoiceAgent from "@/components/voice/PatientVoiceAgent";

export default function VoiceAgentPage() {
  return (
    <main className="h-[calc(100dvh-3.5rem)] min-w-0 flex-1 overflow-hidden bg-slate-100 md:h-dvh">
      <PatientVoiceAgent />
    </main>
  );
}
