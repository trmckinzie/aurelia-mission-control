import { ChatStream } from "@/components/dashboard/ChatStream";
import { ContextCanvas } from "@/components/dashboard/ContextCanvas";
import { CONTEXT_CANVAS_MARKDOWN, INITIAL_MESSAGES } from "@/lib/mock-data";

export default function Home() {
  return (
    <>
      <main className="flex-1 overflow-y-auto px-6 py-5">
        <ChatStream messages={INITIAL_MESSAGES} />
      </main>

      <ContextCanvas markdown={CONTEXT_CANVAS_MARKDOWN} title="testing-effect.md" />
    </>
  );
}
