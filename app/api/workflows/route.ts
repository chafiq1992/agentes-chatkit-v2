import {
  loadWorkflows,
  addWorkflow,
  renameWorkflow,
  deleteWorkflow,
} from "@/lib/gcs-workflows";

// Must use Node.js runtime for GCS SDK (not Edge)
export const runtime = "nodejs";

/**
 * GET /api/workflows — Return all saved workflows
 */
export async function GET(): Promise<Response> {
  try {
    const workflows = await loadWorkflows();
    return Response.json({ workflows });
  } catch (err) {
    console.error("[api/workflows] GET error:", err);
    return Response.json(
      { error: "Failed to load workflows" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows — Add a new workflow
 * Body: { id: string, name: string }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { id?: string; name?: string };
    const id = body.id?.trim();
    const name = body.name?.trim() || `Agent ${Date.now()}`;

    if (!id) {
      return Response.json({ error: "Missing workflow id" }, { status: 400 });
    }

    const workflows = await addWorkflow({ id, name });
    return Response.json({ workflows });
  } catch (err) {
    console.error("[api/workflows] POST error:", err);
    return Response.json(
      { error: "Failed to add workflow" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows — Rename a workflow
 * Body: { id: string, name: string }
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { id?: string; name?: string };
    const id = body.id?.trim();
    const name = body.name?.trim();

    if (!id || !name) {
      return Response.json(
        { error: "Missing workflow id or name" },
        { status: 400 }
      );
    }

    const workflows = await renameWorkflow(id, name);
    return Response.json({ workflows });
  } catch (err) {
    console.error("[api/workflows] PATCH error:", err);
    return Response.json(
      { error: "Failed to rename workflow" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows — Remove a workflow
 * Body: { id: string }
 */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();

    if (!id) {
      return Response.json({ error: "Missing workflow id" }, { status: 400 });
    }

    const workflows = await deleteWorkflow(id);
    return Response.json({ workflows });
  } catch (err) {
    console.error("[api/workflows] DELETE error:", err);
    return Response.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
