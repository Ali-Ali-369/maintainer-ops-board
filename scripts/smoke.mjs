import { readFile } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "data/sample-board.json",
  "assets/mark.svg"
];

for (const file of requiredFiles) {
  const text = await readFile(file, "utf8");
  if (!text.trim()) {
    throw new Error(`${file} is empty`);
  }
}

const html = await readFile("index.html", "utf8");
const app = await readFile("app.js", "utf8");
const data = JSON.parse(await readFile("data/sample-board.json", "utf8"));

for (const id of [
  "metrics",
  "issue-list",
  "issue-detail",
  "activity-chart",
  "release-checklist",
  "risk-grid",
  "owner-filter",
  "status-filter",
  "export-markdown",
  "export-json",
  "import-json",
  "reset-board"
]) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`missing #${id}`);
  }
}

if (!Array.isArray(data.issues) || data.issues.length < 4) {
  throw new Error("sample board needs at least four issues");
}

for (const marker of ["navigator.clipboard", "localStorage", "importBoard", "downloadFile", "renderIssueDetail"]) {
  if (!app.includes(marker)) {
    throw new Error(`app marker missing: ${marker}`);
  }
}

if (!data.project || !Array.isArray(data.release) || !Array.isArray(data.risks)) {
  throw new Error("app interactions are missing");
}

console.log("smoke ok");
