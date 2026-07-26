import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const emptyState = () => ({ version: 1, tasks: {}, approvals: {}, commands: [], seenInbound: {}, settingsOverride: {} });

export class JsonFileStore {
  #queue = Promise.resolve();
  constructor(path) { this.path = path; }
  async read() {
    try { return JSON.parse(await readFile(this.path, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return emptyState(); throw error; }
  }
  mutate(mutator) {
    const operation = this.#queue.then(async () => {
      const state = await this.read();
      const result = await mutator(state);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      await rename(temporary, this.path);
      return result;
    });
    this.#queue = operation.catch(() => {});
    return operation;
  }
}

export class MemoryStore {
  constructor(initial = emptyState()) { this.state = structuredClone(initial); }
  async read() { return structuredClone(this.state); }
  async mutate(mutator) { return mutator(this.state); }
}