import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sourceFiles = (await readdir("src", { recursive: true })).filter((file) => file.endsWith(".mjs"));
for (const file of sourceFiles) await import(pathToFileURL(resolve("src", file)));
for (const file of ["package.json", ".mcp.json", ".codex-plugin/plugin.json"]) JSON.parse(await readFile(file, "utf8"));
const allText = await Promise.all(sourceFiles.map((file) => readFile(resolve("src", file), "utf8")));
if (allText.some((text) => text.includes("[TODO:"))) throw new Error("TODO placeholder found");
process.stdout.write(`Imported ${sourceFiles.length} modules and validated manifests.\n`);