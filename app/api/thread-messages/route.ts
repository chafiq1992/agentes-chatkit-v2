import { NextRequest } from "next/server";
export const runtime = "edge";

/**
 * GET /api/thread-messages?thread_id=cthr_xxx
 *
 * Fetches thread items from a ChatKit thread using the ChatKit Threads API.
 * Supports both ChatKit threads (cthr_) and legacy Assistants threads (thread_).
 * The client calls this after onResponseEnd to get the actual assistant text
 * that the ChatKit widget rendered (but doesn't expose via onLog events).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const threadId = request.nextUrl.searchParams.get("thread_id");

  if (!threadId) {
    return new Response(JSON.stringify({ error: "Missing thread_id parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const apiBase = process.env.CHATKIT_API_BASE ?? "https://api.openai.com";
    const isChatKitThread = threadId.startsWith("cthr_");

    // Use the correct API based on thread type
    if (isChatKitThread) {
      return await fetchChatKitThreadItems(apiBase, threadId, openaiApiKey);
    } else {
      return await fetchAssistantsThreadMessages(apiBase, threadId, openaiApiKey);
    }
  } catch (error) {
    console.error("[thread-messages] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch thread messages" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Fetch items from a ChatKit thread (cthr_ prefix).
 * Uses the ChatKit Threads API: /v1/chatkit/threads/{thread_id}/items
 */
async function fetchChatKitThreadItems(
  apiBase: string,
  threadId: string,
  apiKey: string
): Promise<Response> {
  // Try multiple endpoint patterns for ChatKit threads
  const endpoints = [
    `${apiBase}/v1/chatkit/threads/${threadId}/items?order=asc&limit=50`,
    `${apiBase}/v1/chatkit/threads/${threadId}/messages?order=asc&limit=50`,
    `${apiBase}/v1/chatkit/threads/${threadId}`,
  ];

  let lastError = "";

  for (const url of endpoints) {
    console.log("[thread-messages] Trying ChatKit endpoint:", url);

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
        "Content-Type": "application/json",
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      console.log("[thread-messages] ChatKit response keys:", Object.keys(data as Record<string, unknown>));
      const messages = extractAssistantTextFromChatKit(data as Record<string, unknown>);
      console.log("[thread-messages] Extracted", messages.length, "assistant messages");

      return new Response(
        JSON.stringify({ thread_id: threadId, messages }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const errorBody = await resp.text().catch(() => "");
    lastError = `${resp.status}: ${errorBody}`;
    console.warn("[thread-messages] ChatKit endpoint failed:", url, resp.status, errorBody.substring(0, 300));

    // If it's a 404, try next endpoint
    if (resp.status === 404) continue;

    // For other errors (401, 403, 500...), don't keep trying
    break;
  }

  console.error("[thread-messages] All ChatKit endpoints failed. Last error:", lastError);
  return new Response(
    JSON.stringify({
      error: "Failed to fetch ChatKit thread items",
      details: lastError,
    }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Extract assistant message texts from ChatKit API response.
 * Handles various response shapes:
 * - { data: [...items...] }  (list of thread items)
 * - { items: [...] }
 * - { messages: [...] }
 * - Direct thread object with embedded items
 */
function extractAssistantTextFromChatKit(
  data: Record<string, unknown>
): Array<{ id: string; created_at: number; text: string }> {
  const results: Array<{ id: string; created_at: number; text: string }> = [];

  // Find the array of items/messages in the response
  const itemArrays = [
    data.data,
    data.items,
    data.messages,
    data.thread_items,
    // If the response is a thread object with items nested
    (data.thread as Record<string, unknown>)?.items,
    (data.thread as Record<string, unknown>)?.data,
  ].filter((arr) => Array.isArray(arr)) as Array<unknown[]>;

  if (itemArrays.length === 0) {
    // Maybe it's a single thread object with content directly
    const text = extractTextFromItem(data);
    if (text) {
      results.push({ id: (data.id as string) ?? "unknown", created_at: (data.created_at as number) ?? 0, text });
    }
    return results;
  }

  const items = itemArrays[0];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const itemObj = item as Record<string, unknown>;

    // Check role/type — we want assistant messages
    const role = itemObj.role ?? itemObj.type;
    const isAssistant =
      role === "assistant" ||
      role === "agent" ||
      // Task group items contain assistant outputs
      role === "task_group" ||
      // If no role specified, check for content
      (!role && itemObj.content);

    // Skip user messages and non-assistant items
    if (role === "user" || (!isAssistant && role)) continue;

    const text = extractTextFromItem(itemObj);
    if (text && text.trim()) {
      results.push({
        id: (itemObj.id as string) ?? `item_${results.length}`,
        created_at: (itemObj.created_at as number) ?? 0,
        text: text.trim(),
      });
    }
  }

  return results;
}

/**
 * Extract text from a single thread item, handling various content formats.
 */
function extractTextFromItem(item: Record<string, unknown>): string {
  // Direct text field
  if (typeof item.text === "string") return item.text;

  // Content array: [{ type: "text", text: { value: "..." } }] or [{ type: "text", text: "..." }]
  if (Array.isArray(item.content)) {
    const texts: string[] = [];
    for (const c of item.content) {
      if (!c || typeof c !== "object") continue;
      const cObj = c as Record<string, unknown>;

      if (typeof cObj.text === "string") {
        texts.push(cObj.text);
      } else if (cObj.text && typeof cObj.text === "object") {
        const textObj = cObj.text as Record<string, unknown>;
        if (typeof textObj.value === "string") {
          texts.push(textObj.value);
        }
      }
      // Also check for output_text type
      if (cObj.type === "output_text" && typeof cObj.text === "string") {
        texts.push(cObj.text);
      }
    }
    if (texts.length > 0) return texts.join("\n");
  }

  // Message envelope: { message: { content: [...] } }
  if (item.message && typeof item.message === "object") {
    return extractTextFromItem(item.message as Record<string, unknown>);
  }

  // Output field
  if (typeof item.output === "string") return item.output;
  if (Array.isArray(item.output)) {
    const texts: string[] = [];
    for (const o of item.output) {
      if (typeof o === "string") texts.push(o);
      else if (o && typeof o === "object") {
        const text = extractTextFromItem(o as Record<string, unknown>);
        if (text) texts.push(text);
      }
    }
    if (texts.length > 0) return texts.join("\n");
  }

  // Body field (some API formats wrap content in body)
  if (item.body && typeof item.body === "object") {
    return extractTextFromItem(item.body as Record<string, unknown>);
  }

  return "";
}

/**
 * Legacy: Fetch messages from an Assistants API thread (thread_ prefix).
 */
async function fetchAssistantsThreadMessages(
  apiBase: string,
  threadId: string,
  apiKey: string
): Promise<Response> {
  const messagesResp = await fetch(
    `${apiBase}/v1/threads/${threadId}/messages?order=desc&limit=20`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json",
      },
    }
  );

  if (!messagesResp.ok) {
    const errorBody = await messagesResp.text().catch(() => "");
    console.error("[thread-messages] OpenAI Assistants error:", messagesResp.status, errorBody);
    return new Response(
      JSON.stringify({
        error: `OpenAI API error: ${messagesResp.status}`,
        details: errorBody,
      }),
      {
        status: messagesResp.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const data = (await messagesResp.json()) as {
    data?: Array<{
      id: string;
      role: string;
      content: Array<{ type: string; text?: { value: string } }>;
      created_at: number;
    }>;
  };

  const assistantMessages = (data.data ?? [])
    .filter((msg) => msg.role === "assistant")
    .map((msg) => ({
      id: msg.id,
      created_at: msg.created_at,
      text: msg.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text?.value ?? "")
        .join("\n") ?? "",
    }));

  return new Response(
    JSON.stringify({
      thread_id: threadId,
      messages: assistantMessages,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
