import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function createTaskCode(existing = new Set(), length = 3) {
  if (length < 3 || length > 6) throw new Error("Task code length must be between 3 and 6");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = "";
    for (let index = 0; index < length; index += 1) code += ALPHABET[randomInt(ALPHABET.length)];
    if (!existing.has(code)) return code;
  }
  throw new Error("Could not allocate a unique task code");
}

export function normalizeTaskCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!new RegExp(`^[${ALPHABET}]{3,6}$`).test(code)) throw new Error(`Invalid task code: ${value}`);
  return code;
}