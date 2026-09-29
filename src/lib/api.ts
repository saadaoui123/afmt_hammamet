export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data as T;
}

export function currentAuthor(): string {
  if (typeof window === "undefined") return "Ines Khrifech";
  return localStorage.getItem("ifmt-author") || "Ines Khrifech";
}

export function setAuthor(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("ifmt-author", name.trim() || "Ines Khrifech");
}
