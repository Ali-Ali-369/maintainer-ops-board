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

for (const id of ["metrics", "issue-list", "activity-chart", "release-checklist", "risk-grid"]) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`missing #${id}`);
  }
}

if (!Array.isArray(data.issues) || data.issues.length < 4) {
  throw new Error("sample board needs at least four issues");
}

if (!app.includes("navigator.clipboard") || !app.includes("renderIssues")) {
  throw new Error("app interactions are missing");
}

console.log("smoke ok");
