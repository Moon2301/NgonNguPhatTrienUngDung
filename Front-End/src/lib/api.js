const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error ?? "request_failed";
    throw new Error(message);
  }
  return data;
}

