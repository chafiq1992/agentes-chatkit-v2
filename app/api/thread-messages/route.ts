import { NextRequest } from "next/server";
export const runtime = "edge";

/**
 * GET /api/thread-messages?thread_id=thread_xxx
 *
 * Fetches messages from an OpenAI thread using the API key on the server side.
 * The client calls this after onResponseEnd to get the actual assistant text
 * that the ChatKit widget rendered (but doesn't expose to us).
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

    // Fetch messages from the thread
    const messagesResp = await fetch(
      `${apiBase}/v1/threads/${threadId}/messages?order=desc&limit=10`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "OpenAI-Beta": "assistants=v2",
          "Content-Type": "application/json",
        },
      }
    );

    if (!messagesResp.ok) {
      const errorBody = await messagesResp.text().catch(() => "");
      console.error("[thread-messages] OpenAI error:", messagesResp.status, errorBody);
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

    // Extract assistant messages with their text
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
