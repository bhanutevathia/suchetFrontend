export async function api(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} failed`);
  return res.json();
}
