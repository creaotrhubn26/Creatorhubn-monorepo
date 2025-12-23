export async function getKV<T = any>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/user/kv/${encodeURIComponent(key)}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    // Expecting { value: any } or raw value
    if (data && typeof data === 'object' && 'value' in data) return data.value as T;
    return (data as T) ?? null;
  } catch {
    return null;
  }
}

export async function setKV<T = any>(key: string, value: T): Promise<boolean> {
  try {
    const res = await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key, value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
