import { ComingSoon } from "@/components/coming-soon";

export default function AiPage() {
  return (
    <ComingSoon
      title="AI 도우미"
      phase="Phase 5"
      description="DB 조회 기반 질의응답으로 시작해, RAG로 확장됩니다. GEMINI_API_KEY 연결 후 이용할 수 있습니다."
    />
  );
}
