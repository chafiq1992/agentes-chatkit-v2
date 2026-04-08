"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

export type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onResponseStart?: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
  onResponseJSON?: (payload: { outputs: unknown[]; full: unknown; text?: string }) => void;
  workflowId?: string;
};

export type ChatKitPanelHandle = {
  getLastResults: () => { outputs: unknown[]; full: unknown; text?: string } | null;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

/** Check if a string looks like a ChatKit or Assistants thread ID */
function isThreadId(val: unknown): val is string {
  return (
    typeof val === "string" &&
    (val.startsWith("thread_") || val.startsWith("cthr_"))
  );
}

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

/**
 * Extract JSON objects from raw text by brace-matching.
 * Handles concatenated JSON objects and JSON embedded in other text.
 */
function extractJsonFromText(raw: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  if (!raw) return results;

  // Strip common ChatGPT artifacts
  const cleaned = raw
    .replace(/^Thought for \d+s?\s*$/gm, "")
    .replace(/^The assistant said:\s*$/gm, "")
    .trim();

  // Brace-matching to find all top-level JSON objects
  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
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

/**
 * Try EVERY possible method to extract text from the ChatKit widget.
 * The widget may use shadow DOM, iframes, or regular DOM. We try them all.
 * Returns the longest non-empty text found.
 */
function extractAllTextFromWidget(container: HTMLElement): string {
  const attempts: { method: string; text: string }[] = [];

  // Method 1: Direct textContent on container
  try {
    const t = (container.textContent ?? "").trim();
    attempts.push({ method: "container.textContent", text: t });
  } catch {}

  // Method 2: Direct innerText on container (respects CSS visibility)
  try {
    const t = (container.innerText ?? "").trim();
    attempts.push({ method: "container.innerText", text: t });
  } catch {}

  // Method 3: Find openai-chatkit web component and access shadow root
  try {
    const chatEl = container.querySelector("openai-chatkit");
    if (chatEl) {
      const sr = chatEl.shadowRoot;
      if (sr) {
        const t1 = (sr.textContent ?? "").trim();
        attempts.push({ method: "shadowRoot.textContent", text: t1 });
        // Also try getting innerText from shadow root children
        const srDiv = sr.querySelector("div");
        if (srDiv) {
          const t2 = (srDiv.innerText ?? "").trim();
          attempts.push({ method: "shadowRoot>div.innerText", text: t2 });
        }
      }
      // Also try the element itself
      const t3 = ((chatEl as HTMLElement).innerText ?? "").trim();
      attempts.push({ method: "chatEl.innerText", text: t3 });
    }
  } catch {}

  // Method 4: Find any iframes and try to read their content
  try {
    const iframes = container.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      try {
        const doc = iframes[i].contentDocument;
        if (doc) {
          const t = (doc.body?.innerText ?? "").trim();
          attempts.push({ method: `iframe[${i}].innerText`, text: t });
        }
      } catch {
        attempts.push({ method: `iframe[${i}]`, text: "[cross-origin blocked]" });
      }
    }
  } catch {}

  // Method 5: Find all elements with substantial text content
  try {
    const allElements = container.querySelectorAll("*");
    let longestDirectText = "";
    for (let i = 0; i < allElements.length && i < 500; i++) {
      const el = allElements[i] as HTMLElement;
      // Check if this element has direct text content (not from children)
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? "").trim())
        .filter((t) => t.length > 50)
        .join(" ");
      if (directText.length > longestDirectText.length) {
        longestDirectText = directText;
      }
    }
    if (longestDirectText) {
      attempts.push({ method: "directTextNodes", text: longestDirectText });
    }
  } catch {}

  // Method 6: Look for specific message-like containers
  try {
    const selectors = [
      '[class*="message"]', '[class*="response"]', '[class*="content"]',
      '[class*="thread"]', '[class*="output"]', '[class*="text"]',
      '[role="log"]', '[role="main"]', 'article', 'main',
    ];
    for (const sel of selectors) {
      const els = container.querySelectorAll(sel);
      for (let i = 0; i < els.length; i++) {
        const t = ((els[i] as HTMLElement).innerText ?? "").trim();
        if (t.length > 100) {
          attempts.push({ method: `selector:${sel}[${i}]`, text: t });
        }
      }
    }
  } catch {}

  // Log all attempts for debugging
  console.log("[ChatKitPanel:extractText] Attempts:");
  for (const a of attempts) {
    const preview = a.text.length > 200 ? a.text.substring(0, 200) + "..." : a.text;
    console.log(`  ${a.method}: length=${a.text.length} ${preview ? `"${preview}"` : "(empty)"}`);
  }

  // Return the longest text found (most likely to contain all messages)
  const best = attempts
    .filter((a) => a.text.length > 10 && !a.text.startsWith("[cross-origin"))
    .sort((a, b) => b.text.length - a.text.length)[0];

  if (best) {
    console.log("[ChatKitPanel:extractText] Best:", best.method, "length:", best.text.length);
    return best.text;
  }

  console.warn("[ChatKitPanel:extractText] No text found from any method!");
  return "";
}

export const ChatKitPanel = forwardRef<ChatKitPanelHandle, ChatKitPanelProps>(function ChatKitPanel(
  {
    theme,
    onWidgetAction,
    onResponseEnd,
    onResponseStart,
    onThemeRequest,
    onResponseJSON,
    workflowId,
  }: ChatKitPanelProps,
  ref
) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);
  const collectingLogsRef = useRef(false);
  const responseLogsRef = useRef<unknown[]>([]);
  const jsonCandidatesRef = useRef<unknown[]>([]);
  const lastCapturedOutputsRef = useRef<unknown[]>([]);
  const lastCapturedFullRef = useRef<unknown>(null);
  const textBufferRef = useRef<string[]>([]);
  const lastCapturedTextRef = useRef<string>("");
  const jsonTextBufferRef = useRef<string[]>([]);
  // Fetch interceptor buffer: captures text from OpenAI's SSE responses
  const fetchInterceptBufferRef = useRef<string[]>([]);
  // Track already-processed message IDs to avoid duplicate emissions
  const processedMessageIdsRef = useRef(new Set<string>());
  // Track the last DOM text snapshot so we can diff to find new content
  const lastDomSnapshotRef = useRef<string>("");
  // Thread ID captured from ChatKit events for backend message fetching
  const threadIdRef = useRef<string | null>(null);

  // Set up fetch interceptor to capture OpenAI streaming responses
  useEffect(() => {
    if (!isBrowser) return;

    const originalFetch = window.fetch;
    const interceptedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);

      // Check if this is an OpenAI API call
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url;
      const isOpenAICall = url && (
        url.includes("api.openai.com") ||
        url.includes("chatkit") ||
        url.includes("responses") ||
        url.includes("threads")
      );

      if (isOpenAICall && response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
        // Clone the response so ChatKit still gets its data
        const [forChatKit, forUs] = response.body.tee();

        // Read our copy in the background
        const reader = forUs.getReader();
        const decoder = new TextDecoder();

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });

              // Parse SSE events from the chunk
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.substring(6).trim();
                if (jsonStr === "[DONE]") continue;

                try {
                  const evt = JSON.parse(jsonStr);
                  const evtType = evt?.type;

                  // Capture text deltas
                  if (evtType === "response.output_text.delta" && typeof evt.delta === "string") {
                    fetchInterceptBufferRef.current.push(evt.delta);
                    textBufferRef.current.push(evt.delta);
                  }

                  // Capture completed text
                  if (evtType === "response.output_text.done" && typeof evt.text === "string") {
                    console.log("[FetchIntercept] Got completed text, length:", evt.text.length);
                    fetchInterceptBufferRef.current = [evt.text];
                    textBufferRef.current = [evt.text];
                  }

                  // Capture from response.completed
                  if (evtType === "response.completed" && evt.response?.output) {
                    for (const item of evt.response.output) {
                      if (item?.type === "message" && Array.isArray(item.content)) {
                        for (const c of item.content) {
                          if (c?.type === "output_text" && typeof c.text === "string") {
                            console.log("[FetchIntercept] Got message text from response.completed, length:", c.text.length);
                            fetchInterceptBufferRef.current = [c.text];
                            textBufferRef.current = [c.text];
                          }
                        }
                      }
                    }
                  }
                } catch {
                  // Not JSON, skip
                }
              }
            }
          } catch (e) {
            console.warn("[FetchIntercept] Stream read error:", e);
          }
        })();

        // Return a new response with the ChatKit stream
        return new Response(forChatKit, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      return response;
    };

    window.fetch = interceptedFetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  const handleLog = useCallback((detail: { name: string; data?: Record<string, unknown> }) => {
    // Collect all diagnostic logs during a single assistant response
    if (!collectingLogsRef.current) return;
    try {
      const entry = { name: detail?.name, data: detail?.data } as Record<string, unknown>;
      responseLogsRef.current.push(entry);

      // DEBUG: Log every single event for diagnosis
      console.log("[ChatKitPanel:onLog]", detail?.name, JSON.stringify(detail?.data ?? {}).substring(0, 500));

      // Extract thread_id from log events — check known fields and scan recursively
      const logData = detail?.data ?? {};
      const threadCandidates = [
        (logData as Record<string, unknown>).thread_id,
        (logData as Record<string, unknown>).threadId,
        (logData as Record<string, unknown>).chatkit_thread_id,
        ((logData as Record<string, unknown>).thread as Record<string, unknown>)?.id,
        ((logData as Record<string, unknown>).item as Record<string, unknown>)?.thread_id,
        ((logData as Record<string, unknown>).session as Record<string, unknown>)?.thread_id,
        ((logData as Record<string, unknown>).body as Record<string, unknown>)?.thread_id,
      ];
      // Also recursively scan for any cthr_ or thread_ string in the data
      const scanForThreadId = (obj: unknown, depth: number): string | null => {
        if (depth > 4) return null;
        if (isThreadId(obj)) return obj;
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          for (const v of Object.values(obj as Record<string, unknown>)) {
            const found = scanForThreadId(v, depth + 1);
            if (found) return found;
          }
        }
        if (Array.isArray(obj)) {
          for (const item of obj.slice(0, 5)) {
            const found = scanForThreadId(item, depth + 1);
            if (found) return found;
          }
        }
        return null;
      };

      for (const tc of threadCandidates) {
        if (isThreadId(tc)) {
          threadIdRef.current = tc;
          console.log("[ChatKitPanel] Thread ID captured from log:", tc);
          break;
        }
      }
      // Fallback: recursive scan if none of the explicit candidates matched
      if (!threadIdRef.current) {
        const scanned = scanForThreadId(logData, 0);
        if (scanned) {
          threadIdRef.current = scanned;
          console.log("[ChatKitPanel] Thread ID captured from recursive scan:", scanned);
        }
      }

      // Heuristically extract structured JSON objects from the log payloads
      const maybeObjects: unknown[] = [];

      const pushIfObject = (v: unknown) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          maybeObjects.push(v);
        }
      };

      // Direct object forms commonly used: data.output, data.output_json, data.result, data.payload
      const data = (entry.data ?? {}) as Record<string, unknown>;
      pushIfObject((data as { output?: unknown }).output);
      pushIfObject((data as { output_json?: unknown }).output_json);
      pushIfObject((data as { result?: unknown }).result);
      pushIfObject((data as { payload?: unknown }).payload);

      // ChatKit traces often include thread item envelopes; extract nested workflow item bodies
      // Known shapes we try to normalize:
      // - { item: { type, response_items?, workflow? } }
      // - { body: { item: {...} } }
      const threadItem = (data as { item?: unknown }).item;
      if (threadItem && typeof threadItem === "object") {
        // raw item object
        pushIfObject(threadItem);
        const workflow = (threadItem as Record<string, unknown>).workflow;
        if (workflow && typeof workflow === "object") {
          pushIfObject(workflow);
        }
        const responseItems = (threadItem as Record<string, unknown>).response_items;
        if (Array.isArray(responseItems)) {
          for (const ri of responseItems) {
            pushIfObject(ri);
          }
        }
      }
      const body = (data as { body?: unknown }).body;
      if (body && typeof body === "object") {
        pushIfObject(body);
        const innerItem = (body as Record<string, unknown>).item;
        if (innerItem && typeof innerItem === "object") {
          pushIfObject(innerItem);
          const innerWorkflow = (innerItem as Record<string, unknown>).workflow;
          if (innerWorkflow && typeof innerWorkflow === "object") {
            pushIfObject(innerWorkflow);
          }
        }
      }

      // Collect likely text snippets for convenience rendering outside the widget
      const pushIfString = (v: unknown) => {
        if (typeof v === "string" && v.trim()) {
          textBufferRef.current.push(v);
        }
      };
      pushIfString((data as { text?: unknown }).text);
      pushIfString((data as { content?: unknown }).content);

      // Heuristics for ChatKit streaming deltas
      const delta = (data as { delta?: unknown }).delta;
      if (typeof delta === "string" && delta) {
        textBufferRef.current.push(delta);
      }
      const deltaJson = (data as { delta_json?: unknown }).delta_json;
      if (typeof deltaJson === "string" && deltaJson) {
        jsonTextBufferRef.current.push(deltaJson);
      }

      // ChatKit Responses API style streaming entries
      const typeField = (data as { type?: unknown }).type;
      if (typeField === "response.output_text.delta") {
        const d = (data as { delta?: unknown }).delta;
        if (typeof d === "string") {
          textBufferRef.current.push(d);
        }
      }
      if (typeField === "response.output_json.delta") {
        const jd = (data as { delta?: unknown }).delta;
        if (typeof jd === "string") {
          jsonTextBufferRef.current.push(jd);
        }
      }

      // Capture completed text from thread.message.completed or response.output_text.done events
      if (typeField === "response.output_text.done" || typeField === "response.text.done") {
        const completedText = (data as { text?: unknown }).text;
        if (typeof completedText === "string" && completedText.trim()) {
          textBufferRef.current = [completedText];
        }
      }

      if (typeField === "response.completed" || typeField === "thread.message.completed") {
        // Try to extract the final assembled text
        const output = (data as { output?: unknown[] }).output;
        if (Array.isArray(output)) {
          for (const item of output) {
            if (item && typeof item === "object") {
              const txtArr = (item as Record<string, unknown>).text;
              if (typeof txtArr === "string" && txtArr.trim()) {
                textBufferRef.current = [txtArr];
              }
              const content2 = (item as Record<string, unknown>).content;
              if (Array.isArray(content2)) {
                for (const ci of content2) {
                  if (ci && typeof ci === "object") {
                    const t = (ci as Record<string, unknown>).text;
                    if (typeof t === "string" && t.trim()) {
                      textBufferRef.current = [t];
                    }
                  }
                }
              }
            }
          }
        }
        // Also check for message content
        const message = (data as { message?: unknown }).message;
        if (message && typeof message === "object") {
          const msgContent = (message as Record<string, unknown>).content;
          if (Array.isArray(msgContent)) {
            for (const ci of msgContent) {
              if (ci && typeof ci === "object") {
                const t = (ci as Record<string, unknown>).text;
                const v = (ci as { text?: { value?: string } }).text;
                if (typeof t === "string" && t.trim()) {
                  textBufferRef.current = [t];
                } else if (typeof v === "object" && typeof v?.value === "string" && v.value.trim()) {
                  textBufferRef.current = [v.value];
                }
              }
            }
          }
        }
      }

      // Some payloads provide a content array with text items
      const content = (data as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item && typeof item === "object") {
            const maybeText = (item as Record<string, unknown>).text;
            if (typeof maybeText === "string" && maybeText.trim()) {
              textBufferRef.current.push(maybeText);
            } else if (
              maybeText &&
              typeof maybeText === "object" &&
              typeof (maybeText as { value?: unknown }).value === "string"
            ) {
              const val = (maybeText as { value: string }).value;
              if (val.trim()) {
                textBufferRef.current.push(val);
              }
            }
          }
        }
      }

      // Scan string fields for embedded JSON
      const scanStringsForJson = (val: unknown) => {
        if (typeof val === "string") {
          const t = val.trim();
          if (t.startsWith("{") && t.endsWith("}")) {
            try {
              const parsed = JSON.parse(t);
              pushIfObject(parsed);
            } catch {}
          }
        } else if (val && typeof val === "object") {
          for (const v of Object.values(val as Record<string, unknown>)) {
            scanStringsForJson(v);
          }
        }
      };
      scanStringsForJson(data);

      if (maybeObjects.length > 0) {
        // Deduplicate by JSON string
        const seen = new Set(
          jsonCandidatesRef.current
            .map((o) => {
              try {
                return JSON.stringify(o);
              } catch {
                return null;
              }
            })
            .filter(Boolean) as string[]
        );
        for (const obj of maybeObjects) {
          try {
            const key = JSON.stringify(obj);
            if (!seen.has(key)) {
              jsonCandidatesRef.current.push(obj);
              seen.add(key);
            }
          } catch {
            // ignore non-serializable
          }
        }
      }
    } catch {
      // ignore malformed diagnostics
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const effectiveWorkflowId = (workflowId?.trim() || WORKFLOW_ID).trim();
  const isWorkflowConfigured = Boolean(
    effectiveWorkflowId && !effectiveWorkflowId.startsWith("wf_replace")
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Provide a workflowId prop or set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    lastDomSnapshotRef.current = "";
    if (isBrowser) {
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: effectiveWorkflowId,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Provide a workflowId prop or set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow: { id: effectiveWorkflowId },
            chatkit_configuration: {
              // enable attachments
              file_upload: {
                enabled: true,
              },
            },
          }),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [effectiveWorkflowId, isWorkflowConfigured, setErrorState]
  );

  const widgetContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Extract the last assistant message text directly from the ChatKit widget DOM.
   * This is a fallback strategy kept for debugging; ChatKit's onLog events don't reliably
   * expose the actual message content, and the shadow root may block access.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const extractTextFromDOM = useCallback((): string => {
    const container = widgetContainerRef.current;
    if (!container) return "";

    try {
      // ChatKit renders messages inside the <openai-chatkit> web component.
      // Look for all assistant message elements. The widget uses various class names
      // and data attributes. We try multiple selectors.
      const chatEl = container.querySelector("openai-chatkit");
      const root = chatEl?.shadowRoot ?? chatEl ?? container;

      // Strategy 1: Look for message elements with role or data attributes
      const selectors = [
        '[data-role="assistant"]',
        '[data-message-role="assistant"]',
        '.assistant-message',
        '[class*="assistant"]',
        '[class*="message"]',
      ];

      let allMessages: Element[] = [];
      for (const sel of selectors) {
        const found = root.querySelectorAll(sel);
        if (found.length > 0) {
          allMessages = Array.from(found);
          break;
        }
      }

      // Strategy 2: If no specific selectors matched, get all text blocks
      // in the widget that could be message containers
      if (allMessages.length === 0) {
        // Look for the thread/message list area
        const threadSelectors = [
          '[class*="thread"]',
          '[class*="messages"]',
          '[class*="conversation"]',
          '[role="log"]',
          '[role="list"]',
        ];
        for (const sel of threadSelectors) {
          const threadEl = root.querySelector(sel);
          if (threadEl) {
            // Get all direct children or message-like blocks
            const children = threadEl.querySelectorAll('[class*="message"], [class*="item"], [class*="turn"]');
            if (children.length > 0) {
              allMessages = Array.from(children);
              break;
            }
          }
        }
      }

      // Strategy 3: Broadest fallback — get all text from the widget
      if (allMessages.length === 0) {
        const fullText = (chatEl ?? container).textContent ?? "";
        return fullText;
      }

      // Get the last message (most recent assistant response)
      const lastMessage = allMessages[allMessages.length - 1];
      return lastMessage?.textContent ?? "";
    } catch (e) {
      if (isDev) console.warn("[ChatKitPanel] DOM extraction failed", e);
      return "";
    }
  }, []);

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: {
        // Enable attachments
        enabled: true,
      },
    },
    threadItemActions: {
      feedback: false,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseStart: () => {
      setErrorState({ integration: null, retryable: false });
      collectingLogsRef.current = true;
      responseLogsRef.current = [];
      jsonCandidatesRef.current = [];
      textBufferRef.current = [];
      jsonTextBufferRef.current = [];
      fetchInterceptBufferRef.current = [];
      try { (onResponseStart ?? (() => {}))(); } catch {}
    },
    onResponseEnd: () => {
      onResponseEnd();
      collectingLogsRef.current = false;
      // NOTE: We intentionally do NOT emit any auto-captured text here.
      // ChatKit renders inside a cross-origin iframe within a shadow DOM,
      // making it impossible to read the actual chat text from JavaScript.
      // Users should use the "Paste Output" button in the Output Panel instead.
      responseLogsRef.current = [];
      jsonCandidatesRef.current = [];
      textBufferRef.current = [];
      jsonTextBufferRef.current = [];
      fetchInterceptBufferRef.current = [];
    },
    onThreadChange: (threadInfo: unknown) => {
      processedFacts.current.clear();
      // Capture thread_id from the thread change event
      if (threadInfo && typeof threadInfo === "object") {
        const tid = (threadInfo as Record<string, unknown>).thread_id ??
                    (threadInfo as Record<string, unknown>).id ??
                    (threadInfo as Record<string, unknown>).threadId;
        if (isThreadId(tid)) {
          threadIdRef.current = tid;
          // Reset processed messages and DOM snapshot when thread changes
          processedMessageIdsRef.current.clear();
          lastDomSnapshotRef.current = "";
          console.log("[ChatKitPanel] Thread ID captured from onThreadChange:", tid);
        }
      }
    },
    onLog: handleLog,
    onError: ({ error }: { error: unknown }) => {
      console.error("ChatKit error", error);
    },
  });

  useEffect(() => {
    // In some environments, `useChatKit({ onLog })` may not fire. The web component always emits `chatkit.log`.
    const el = (chatkit.control as unknown as { ref?: { current?: unknown } })?.ref
      ?.current as
      | (EventTarget & { addEventListener: EventTarget["addEventListener"] })
      | undefined;

    if (!el?.addEventListener) return;

    const onLogEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>)?.detail as unknown;
      if (detail && typeof detail === "object" && "name" in (detail as Record<string, unknown>)) {
        handleLog(detail as { name: string; data?: Record<string, unknown> });
      }
    };

    el.addEventListener(
      "chatkit.log" as unknown as keyof HTMLElementEventMap,
      onLogEvent as EventListener
    );
    return () => {
      el.removeEventListener(
        "chatkit.log" as unknown as keyof HTMLElementEventMap,
        onLogEvent as EventListener
      );
    };
  }, [chatkit.control, handleLog]);

  useImperativeHandle(ref, () => ({
    getLastResults: () => {
      const outputs = Array.isArray(lastCapturedOutputsRef.current)
        ? lastCapturedOutputsRef.current
        : [];
      const full = lastCapturedFullRef.current;
      const text = lastCapturedTextRef.current || undefined;
      if (!outputs.length && (full == null || (Array.isArray(full) && full.length === 0))) {
        return null;
      }
      return { outputs, full, text };
    },
  }));

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: effectiveWorkflowId,
    });
  }

  return (
    <div ref={widgetContainerRef} className="relative pb-8 flex h-full w-full rounded-xl flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className="block h-full w-full"
      />
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession
            ? null
            : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
});

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
