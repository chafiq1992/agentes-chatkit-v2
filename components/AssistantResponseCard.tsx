"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "./CopyButton";

type ResponsePayload = { outputs: unknown[]; full: unknown; text?: string };

type Block =
  | { kind: "text"; content: string }
  | { kind: "code"; content: string; lang?: string };

function parseFencedBlocks(raw: string): Block[] {
  const text = raw ?? "";
  if (!text.includes("```")) return [{ kind: "text", content: text }];

  const parts = text.split("```");
  const blocks: Block[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    if (i % 2 === 0) {
      if (part) blocks.push({ kind: "text", content: part });
    } else {
      const firstNewline = part.indexOf("\n");
      const header = firstNewline === -1 ? part : part.slice(0, firstNewline);
      const body = firstNewline === -1 ? "" : part.slice(firstNewline + 1);
      const lang = header.trim() || undefined;
      blocks.push({ kind: "code", content: body.replace(/\n$/, ""), lang });
    }
  }
  return blocks.length ? blocks : [{ kind: "text", content: text }];
}

export function AssistantResponseCard({
  response,
  title,
  isHighlighted = false,
}: {
  response: ResponsePayload;
  title: string;
  isHighlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasText = Boolean(response.text?.trim());
  const text = response.text ?? "";

  const blocks = useMemo(() => parseFencedBlocks(text), [text]);
  const hasJson = Array.isArray(response.outputs) && response.outputs.length > 0;
  const jsonText = useMemo(
    () => (hasJson ? JSON.stringify(response.outputs, null, 2) : ""),
    [hasJson, response.outputs]
  );

  const shouldClamp = text.length > 900;
  const clampClass = !expanded && shouldClamp ? "max-h-72 overflow-hidden" : "";

  return (
    <div
      className={[
        "rounded-xl border bg-white shadow-sm",
        isHighlighted
          ? "border-indigo-200 dark:border-indigo-900/60"
          : "border-slate-200 dark:border-slate-800",
        "dark:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Clean, copy-ready output
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <CopyButton text={text} label="Copy text" />
          {hasJson ? <CopyButton text={jsonText} label="Copy JSON" /> : null}
          {shouldClamp ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          ) : null}
        </div>
      </div>

      {hasText ? (
        <div className={["px-4 py-3", clampClass].join(" ")}>
          <div className="space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
            {blocks.map((b, idx) => {
              if (b.kind === "text") {
                return (
                  <div
                    key={idx}
                    className="whitespace-pre-wrap break-words"
                  >
                    {b.content}
                  </div>
                );
              }

              return (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <span className="truncate">{b.lang ? b.lang : "code"}</span>
                    <CopyButton
                      text={b.content}
                      label="Copy"
                      className="border-slate-300 bg-white/70 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900"
                    />
                  </div>
                  <pre className="overflow-auto whitespace-pre p-3 text-xs leading-relaxed text-slate-900 dark:text-slate-100">
                    <code>{b.content}</code>
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      ) : hasJson ? (
        <div className="px-4 py-3">
          <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Text wasn’t captured from ChatKit for this response — showing extracted JSON instead.
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <span className="truncate">json</span>
              <CopyButton
                text={jsonText}
                label="Copy"
                className="border-slate-300 bg-white/70 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900"
              />
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre p-3 text-xs leading-relaxed text-slate-900 dark:text-slate-100">
              <code>{jsonText}</code>
            </pre>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          No text captured for this response yet.
        </div>
      )}

      {hasJson ? (
        <details className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Extracted structured output (JSON)
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre rounded-lg border border-emerald-200 bg-white p-3 text-xs leading-relaxed text-slate-900 dark:border-emerald-900/60 dark:bg-slate-950 dark:text-slate-100">
            <code>{jsonText}</code>
          </pre>
        </details>
      ) : null}
    </div>
  );
}


