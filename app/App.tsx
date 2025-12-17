"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction, type ChatKitPanelHandle } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useState, useRef } from "react";
import { AssistantResponseCard } from "@/components/AssistantResponseCard";
import { CopyButton } from "@/components/CopyButton";

export default function App() {
  const { scheme, setScheme } = useColorScheme();
  const [responses, setResponses] = useState<{ outputs: unknown[]; full: unknown; text?: string }[]>([]);
  const [latestResponse, setLatestResponse] = useState<{ outputs: unknown[]; full: unknown; text?: string } | null>(null);
  const panelRef = useRef<ChatKitPanelHandle | null>(null);

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
    const last = panelRef.current?.getLastResults();
    if (last) {
      setLatestResponse(last);
    }
  }, []);

  const handleResponseJSON = useCallback((payload: { outputs: unknown[]; full: unknown; text?: string }) => {
    setResponses((prev) => [payload, ...prev]);
    setLatestResponse(payload);
  }, []);

  return (
    <main className="relative min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Reserve left column (25vw). Sidebar stays open */}
      <div className="absolute inset-y-0 left-0 z-20 w-[25vw]">
        <div className="h-full">
          <div className="absolute inset-y-0 left-0 w-[25vw] transition-transform duration-300 ease-in-out shadow-xl border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">Chat</div>

            <div className="px-3 pb-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Quick copy (latest assistant output)
                    </div>
                    <div className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                      {latestResponse?.text?.trim()
                        ? latestResponse.text
                        : "No response yet."}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2">
                    <CopyButton text={latestResponse?.text ?? ""} label="Copy" />
                    <CopyButton
                      text={
                        latestResponse?.outputs?.length
                          ? JSON.stringify(latestResponse.outputs, null, 2)
                          : ""
                      }
                      label="Copy JSON"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-3 pb-3">
              <ChatKitPanel
                ref={panelRef}
                theme={scheme}
                onWidgetAction={handleWidgetAction}
                onResponseEnd={handleResponseEnd}
                onThemeRequest={setScheme}
                onResponseJSON={handleResponseJSON}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content occupies remaining 75% width and is never covered */}
      <div className="ml-[25vw] p-4 lg:pl-[2rem]">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Chat Output</h1>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Every assistant response is shown here in a clean, copy-ready format.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton text={latestResponse?.text ?? ""} label="Copy latest" />
              <button
                type="button"
                onClick={() => {
                  setResponses([]);
                  setLatestResponse(null);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-6">
            {responses.length ? (
              <div className="space-y-4">
                {responses.map((resp, idx) => (
                  <AssistantResponseCard
                    key={idx}
                    response={resp}
                    title={`Assistant Response ${responses.length - idx}`}
                    isHighlighted={idx === 0}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                No assistant output yet. Ask something in the chat panel.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
