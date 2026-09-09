import type {
  Machine,
  MachineCreate,
  Material,
  MaterialCreate,
  PrintRequest,
  PrintRequestCreate,
  Spool,
  SpoolCreate,
  SpoolDetail,
} from "../types";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export function getConfiguredApiBaseUrl(): string | null {
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
  }

  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getConfiguredApiBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "Set VITE_API_BASE_URL to your deployed FastAPI backend before using the hosted site.",
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { detail?: string };
      throw new Error(payload.detail ?? "Request failed.");
    }

    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getMaterials(): Promise<Material[]> {
  return request<Material[]>("/materials");
}

export function createMaterial(payload: MaterialCreate): Promise<Material> {
  return request<Material>("/materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSpools(): Promise<Spool[]> {
  return request<Spool[]>("/spools");
}

export function getSpool(id: number): Promise<SpoolDetail> {
  return request<SpoolDetail>(`/spools/${id}`);
}

export function createSpool(payload: SpoolCreate): Promise<Spool> {
  return request<Spool>("/spools", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSpoolWeight(
  id: number,
  payload:
    | { mode: "use_filament"; user_id: string; amount: number }
    | { mode: "set_total_weight"; user_id: string; new_total_weight: number },
): Promise<SpoolDetail> {
  return request<SpoolDetail>(`/spools/${id}/weight`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function correctSpoolEvent(payload: {
  spoolId: number;
  related_event_id: number;
  amount: number;
  reason: string;
  user_id: string;
}): Promise<SpoolDetail> {
  return request<SpoolDetail>(`/spools/${payload.spoolId}/correct`, {
    method: "POST",
    body: JSON.stringify({
      related_event_id: payload.related_event_id,
      amount: payload.amount,
      reason: payload.reason,
      user_id: payload.user_id,
    }),
  });
}

export function assignSpoolToMachine(payload: {
  spoolId: number;
  machine_id: number;
  user_id: string;
}): Promise<SpoolDetail> {
  return request<SpoolDetail>(`/spools/${payload.spoolId}/assign`, {
    method: "POST",
    body: JSON.stringify({
      machine_id: payload.machine_id,
      user_id: payload.user_id,
    }),
  });
}

export function unassignSpoolFromMachine(payload: {
  spoolId: number;
  user_id: string;
}): Promise<SpoolDetail> {
  return request<SpoolDetail>(`/spools/${payload.spoolId}/unassign`, {
    method: "POST",
    body: JSON.stringify({ user_id: payload.user_id }),
  });
}

export function getMachines(): Promise<Machine[]> {
  return request<Machine[]>("/machines");
}

export function createMachine(payload: MachineCreate): Promise<Machine> {
  return request<Machine>("/machines", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPrintRequests(): Promise<PrintRequest[]> {
  return request<PrintRequest[]>("/requests");
}

export function createPrintRequest(
  payload: PrintRequestCreate,
): Promise<PrintRequest> {
  return request<PrintRequest>("/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reserveForRequest(payload: {
  requestId: number;
  user_id: string;
  spool_id?: number;
}): Promise<PrintRequest> {
  return request<PrintRequest>(`/requests/${payload.requestId}/reserve`, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      spool_id: payload.spool_id,
    }),
  });
}

export function releaseReservation(payload: {
  requestId: number;
  user_id: string;
  reservation_id?: number;
}): Promise<PrintRequest> {
  return request<PrintRequest>(`/requests/${payload.requestId}/release`, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      reservation_id: payload.reservation_id,
    }),
  });
}

export function fulfillRequest(payload: {
  requestId: number;
  user_id: string;
  reservation_id?: number;
}): Promise<PrintRequest> {
  return request<PrintRequest>(`/requests/${payload.requestId}/fulfill`, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      reservation_id: payload.reservation_id,
    }),
  });
}
