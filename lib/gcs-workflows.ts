import { Storage } from "@google-cloud/storage";

export type WorkflowEntry = {
  id: string;
  name: string;
};

type WorkflowsData = {
  workflows: WorkflowEntry[];
};

const BUCKET_NAME = process.env.WORKFLOWS_GCS_BUCKET ?? "";
const FILE_PATH = process.env.WORKFLOWS_GCS_PATH ?? "chatkit/workflows.json";

let storageInstance: Storage | null = null;

function getStorage(): Storage {
  if (!storageInstance) {
    const credsJson = process.env.GCS_CREDENTIALS_JSON?.trim();
    if (credsJson) {
      // Use explicit credentials from secret/env var
      try {
        const credentials = JSON.parse(credsJson);
        storageInstance = new Storage({ credentials });
      } catch (err) {
        console.error("[gcs-workflows] Failed to parse GCS_CREDENTIALS_JSON:", err);
        storageInstance = new Storage();
      }
    } else {
      // Fall back to Application Default Credentials (works on Cloud Run automatically)
      storageInstance = new Storage();
    }
  }
  return storageInstance;
}

/**
 * Default workflows seeded on first launch.
 * Uses the env-configured workflow so the app always has at least one.
 */
function getDefaultWorkflows(): WorkflowEntry[] {
  const envId = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim();
  if (envId) {
    return [{ id: envId, name: "Default Agent" }];
  }
  return [];
}

/**
 * Read workflows from GCS. If the file doesn't exist yet, seed it with defaults.
 */
export async function loadWorkflows(): Promise<WorkflowEntry[]> {
  if (!BUCKET_NAME) {
    console.warn("[gcs-workflows] WORKFLOWS_GCS_BUCKET not set, using defaults");
    return getDefaultWorkflows();
  }

  const storage = getStorage();
  const file = storage.bucket(BUCKET_NAME).file(FILE_PATH);

  try {
    const [exists] = await file.exists();
    if (!exists) {
      // First time — seed with defaults
      const defaults = getDefaultWorkflows();
      await saveWorkflows(defaults);
      return defaults;
    }

    const [contents] = await file.download();
    const data = JSON.parse(contents.toString("utf-8")) as WorkflowsData;
    return Array.isArray(data.workflows) ? data.workflows : getDefaultWorkflows();
  } catch (err) {
    console.error("[gcs-workflows] Failed to load workflows from GCS:", err);
    return getDefaultWorkflows();
  }
}

/**
 * Write the full workflows list to GCS.
 */
export async function saveWorkflows(workflows: WorkflowEntry[]): Promise<void> {
  if (!BUCKET_NAME) {
    console.warn("[gcs-workflows] WORKFLOWS_GCS_BUCKET not set, cannot save");
    return;
  }

  const storage = getStorage();
  const file = storage.bucket(BUCKET_NAME).file(FILE_PATH);
  const data: WorkflowsData = { workflows };

  await file.save(JSON.stringify(data, null, 2), {
    contentType: "application/json",
    resumable: false,
  });
}

/**
 * Add a workflow. Returns the updated list. No-op if id already exists.
 */
export async function addWorkflow(entry: WorkflowEntry): Promise<WorkflowEntry[]> {
  const current = await loadWorkflows();
  if (current.find((w) => w.id === entry.id)) {
    return current; // already exists
  }
  const updated = [...current, entry];
  await saveWorkflows(updated);
  return updated;
}

/**
 * Rename a workflow by id. Returns the updated list.
 */
export async function renameWorkflow(id: string, newName: string): Promise<WorkflowEntry[]> {
  const current = await loadWorkflows();
  const updated = current.map((w) =>
    w.id === id ? { ...w, name: newName.trim() || w.name } : w
  );
  await saveWorkflows(updated);
  return updated;
}

/**
 * Delete a workflow by id. Returns the updated list.
 */
export async function deleteWorkflow(id: string): Promise<WorkflowEntry[]> {
  const current = await loadWorkflows();
  const updated = current.filter((w) => w.id !== id);
  await saveWorkflows(updated);
  return updated;
}
