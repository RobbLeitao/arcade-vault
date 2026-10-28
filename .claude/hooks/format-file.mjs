// Hook PostToolUse (Write|Edit): pasa el archivo por Prettier y ESLint.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const bin = (name) => path.join(root, "node_modules", ".bin", name);
const lintable = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const skipped = ["node_modules", ".next", "references"];

let input = "";
for await (const chunk of process.stdin) input += chunk;

let file;
try {
  const data = JSON.parse(input);
  file = data.tool_response?.filePath ?? data.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!file) process.exit(0);

file = path.resolve(file);
const rel = path.relative(root, file);
const inProject = rel && !rel.startsWith("..") && !path.isAbsolute(rel);
const inSkipped = rel.split(path.sep).some((part) => skipped.includes(part));
if (!inProject || inSkipped || !existsSync(file)) process.exit(0);

const run = (name, args) =>
  spawnSync(`"${bin(name)}" ${args.join(" ")} "${file}"`, {
    cwd: root,
    shell: true,
    encoding: "utf8",
  });

run("prettier", ["--write", "--ignore-unknown"]);

if (lintable.test(file)) {
  const lint = run("eslint", ["--fix"]);
  if (lint.status !== 0) {
    process.stderr.write(`${lint.stdout}${lint.stderr}`);
    process.exit(2);
  }
}
