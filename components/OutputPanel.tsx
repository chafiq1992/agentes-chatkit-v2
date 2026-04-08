"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { parseAgentResponse, type ParsedSection } from "@/lib/parseAgentOutput";
import {
  StructuredOutputCard,
  OutputSkeleton,
  ProcessingIndicator,
} from "./StructuredOutputCard";

type ResponsePayload = { outputs: unknown[]; full: unknown; text?: string };

/**
 * Extract JSON objects from raw text using brace-matching.
 * Handles concatenated JSON objects and JSON embedded in other text.
 */
function extractJsonFromPastedText(raw: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  if (!raw) return results;
  const cleaned = raw.trim();

  // Try parsing as a single JSON object first
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      results.push(parsed as Record<string, unknown>);
      return results;
    }
  } catch {}

  // Brace-matching to find all top-level JSON objects
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = cleaned.slice(start, i + 1);
        try {
          const parsed = JSON.parse(slice);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            results.push(parsed as Record<string, unknown>);
          }
        } catch {
          // not valid JSON
        }
        start = -1;
      }
    }
  }

  return results;
}

export function OutputPanel({
  responses,
  isProcessing,
  onClear,
  onPastedResponse,
  activeWorkflowName,
}: {
  responses: ResponsePayload[];
  isProcessing: boolean;
  onClear: () => void;
  onPastedResponse?: (payload: ResponsePayload) => void;
  activeWorkflowName?: string;
}) {
  const [pasteText, setPasteText] = useState("");
  const [showPasteBox, setShowPasteBox] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parse all responses into structured sections
  const parsedResponses = useMemo(() => {
    return responses.map((resp) => ({
      raw: resp,
      sections: parseAgentResponse(resp),
    }));
  }, [responses]);

  const totalSections = parsedResponses.reduce((sum, r) => sum + r.sections.length, 0);
  const hasContent = parsedResponses.length > 0;

  const handlePasteSubmit = useCallback(() => {
    if (!pasteText.trim()) return;

    const text = pasteText.trim();
    const jsonObjects = extractJsonFromPastedText(text);

    const payload: ResponsePayload = {
      outputs: jsonObjects,
      full: null,
      text: text,
    };

    if (onPastedResponse) {
      onPastedResponse(payload);
    }

    setPasteText("");
    setShowPasteBox(false);
  }, [pasteText, onPastedResponse]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Get pasted text
    const text = e.clipboardData.getData("text/plain");
    if (text && text.trim().length > 50) {
      // Auto-submit if pasted text is substantial
      setTimeout(() => {
        const jsonObjects = extractJsonFromPastedText(text.trim());
        if (jsonObjects.length > 0 && onPastedResponse) {
          const payload: ResponsePayload = {
            outputs: jsonObjects,
            full: null,
            text: text.trim(),
          };
          onPastedResponse(payload);
          setPasteText("");
          setShowPasteBox(false);
        }
      }, 100);
    }
  }, [onPastedResponse]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: "var(--surface)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Agent Output
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: "2px 0 0",
            }}
          >
            {hasContent
              ? `${parsedResponses.length} response${parsedResponses.length > 1 ? "s" : ""} · ${totalSections} section${totalSections !== 1 ? "s" : ""}${activeWorkflowName ? ` · ${activeWorkflowName}` : ""}`
              : activeWorkflowName ? `${activeWorkflowName} — Responses will appear here` : "Responses will appear here"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              setShowPasteBox((v) => !v);
              if (!showPasteBox) {
                setTimeout(() => textareaRef.current?.focus(), 100);
              }
            }}
            className="copy-btn"
            style={{
              fontSize: 12,
              background: showPasteBox ? "var(--accent)" : undefined,
              color: showPasteBox ? "#fff" : undefined,
            }}
            title="Paste agent output text from the chat"
          >
            📋 Paste Output
          </button>
          {hasContent && (
            <button
              type="button"
              onClick={onClear}
              className="copy-btn"
              style={{ fontSize: 12 }}
            >
              🗑 Clear all
            </button>
          )}
        </div>
      </div>

      {/* Paste Box */}
      {showPasteBox && (
        <div
          style={{
            padding: "12px 20px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-raised, var(--surface))",
            flexShrink: 0,
          }}
          className="animate-slide-up"
        >
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: "0 0 8px",
              lineHeight: 1.4,
            }}
          >
            Copy the agent&apos;s response from the chat and paste it here. JSON will be auto-detected and parsed.
          </p>
          <textarea
            ref={textareaRef}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste the agent output text here... (Ctrl+V)"
            style={{
              width: "100%",
              minHeight: 80,
              maxHeight: 200,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              fontSize: 12,
              fontFamily: "monospace",
              resize: "vertical",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 8,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPasteText("");
                setShowPasteBox(false);
              }}
              className="copy-btn"
              style={{ fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasteSubmit}
              className="copy-btn"
              style={{
                fontSize: 12,
                background: pasteText.trim() ? "var(--accent)" : undefined,
                color: pasteText.trim() ? "#fff" : undefined,
                opacity: pasteText.trim() ? 1 : 0.5,
              }}
              disabled={!pasteText.trim()}
            >
              ✨ Parse & Display
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Processing indicator */}
        {isProcessing && <ProcessingIndicator />}

        {/* Skeleton when processing and no content yet */}
        {isProcessing && !hasContent && (
          <>
            <OutputSkeleton />
            <OutputSkeleton />
          </>
        )}

        {/* Rendered responses */}
        {parsedResponses.map((parsed, respIdx) => (
          <div key={respIdx} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Response separator if multiple */}
            {parsedResponses.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "4px 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Response {parsedResponses.length - respIdx}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border)",
                  }}
                />
              </div>
            )}

            {/* Sections within each response */}
            {parsed.sections.length > 0 ? (
              parsed.sections.map((section: ParsedSection, secIdx: number) => (
                <StructuredOutputCard
                  key={`${respIdx}-${secIdx}`}
                  section={section}
                  index={secIdx}
                />
              ))
            ) : (
              <div
                className="premium-card animate-slide-up"
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                No structured output could be extracted from this response.
              </div>
            )}
          </div>
        ))}

        {/* Empty State */}
        {!isProcessing && !hasContent && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "60px 20px",
              textAlign: "center",
            }}
            className="animate-fade-in"
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              ✨
            </div>
            <div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--foreground)",
                  marginBottom: 6,
                }}
              >
                No output yet
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  maxWidth: 320,
                  lineHeight: 1.6,
                }}
              >
                Send a message in the chat, then click <strong>&quot;📋 Paste Output&quot;</strong> above to copy the agent&apos;s response and parse it here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
