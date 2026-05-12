import { json } from "../lib/http";

export function handleHealth() {
  return json({ ok: true });
}
