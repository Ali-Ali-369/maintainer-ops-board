const STORAGE_KEY = "maintainer-ops-board:v1";
const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
const statuses = ["Review", "Needs repro", "Ready", "Blocked", "Open", "Reviewed"];

const state = {
  baselineBoard: null,
  board: null,
  selectedIssue: null,
  filters: {
    query: "",
    priority: "all",
    owner: "all",
    status: "all"
  }
};

async function loadBoard() {
  const response = await fetch("data/sample-board.json");
  if (!response.ok) {
    throw new Error(`Could not load board data: ${response.status}`);
  }
  state.baselineBoard = normalizeBoard(await response.json());
  state.board = loadStoredBoard() ?? cloneBoard(state.baselineBoard);
  state.selectedIssue = state.board.issues[0]?.id ?? null;
  render();
}

function render() {
  syncDynamicFilters();
  renderProject();
  renderMetrics();
  renderIssues();
  renderIssueDetail();
  renderActivity();
  renderRelease();
  renderRisks();
}

function renderProject() {
  document.querySelector("#repo-name").textContent = state.board.project.repo;
  document.querySelector("#release-name").textContent = `v${state.board.project.release}`;
}

function renderMetrics() {
  const root = document.querySelector("#metrics");
  root.innerHTML = computedMetrics()
    .map(
      metric => `
        <article class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(String(metric.value))}</strong>
          <em>${escapeHtml(metric.delta)}</em>
        </article>
      `
    )
    .join("");
}

function syncDynamicFilters() {
  syncSelect("#owner-filter", ["all", ...uniqueValues(state.board.issues.map(issue => issue.owner))], state.filters.owner, "All owners");
  syncSelect("#status-filter", ["all", ...uniqueValues(state.board.issues.map(issue => issue.status))], state.filters.status, "All statuses");
}

function syncSelect(selector, values, selected, allLabel) {
  const select = document.querySelector(selector);
  select.innerHTML = values
    .map(value => {
      const label = value === "all" ? allLabel : value;
      return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderIssues() {
  const root = document.querySelector("#issue-list");
  const issues = filteredIssues();

  if (!issues.length) {
    root.innerHTML = `<div class="issue-row"><span>No matching issues</span></div>`;
    return;
  }

  root.innerHTML = issues
    .map(issue => {
      const selected = issue.id === state.selectedIssue ? "true" : "false";
      return `
        <button class="issue-row issue-button" data-issue-id="${issue.id}" aria-pressed="${selected}" type="button">
          <span class="issue-main">
            <strong><span class="pill ${issue.priority.toLowerCase()}">${issue.priority}</span> #${issue.id} ${escapeHtml(issue.title)}</strong>
            <span>${escapeHtml(issue.type)} · ${escapeHtml(issue.age)}</span>
          </span>
          <span>${escapeHtml(issue.owner)}</span>
          <span>${escapeHtml(issue.status)}</span>
          <span class="risk-meter" aria-label="Risk ${issue.risk}">
            <span style="width: ${issue.risk}%"></span>
          </span>
        </button>
      `;
    })
    .join("");

  root.querySelectorAll("[data-issue-id]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedIssue = Number(button.dataset.issueId);
      renderIssueDetail();
      renderIssues();
    });
  });
}

function renderIssueDetail() {
  const root = document.querySelector("#issue-detail");
  const issue = selectedIssue();
  if (!issue) {
    root.innerHTML = `<p class="detail-empty">No issue selected.</p>`;
    return;
  }

  const ownerOptions = uniqueValues([...state.board.issues.map(item => item.owner), "Ali", "Community", "Unassigned"]);
  root.innerHTML = `
    <div class="detail-card">
      <div class="detail-title">
        <h3>#${issue.id} ${escapeHtml(issue.title)}</h3>
        <span class="pill ${issue.priority.toLowerCase()}">${issue.priority}</span>
      </div>
      <div class="detail-meta">
        <label class="detail-field">
          <span>Owner</span>
          <select id="detail-owner">${ownerOptions.map(owner => `<option value="${escapeHtml(owner)}" ${owner === issue.owner ? "selected" : ""}>${escapeHtml(owner)}</option>`).join("")}</select>
        </label>
        <label class="detail-field">
          <span>Status</span>
          <select id="detail-status">${statuses.map(status => `<option value="${escapeHtml(status)}" ${status === issue.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select>
        </label>
        <div class="detail-field">
          <span>Type</span>
          <strong>${escapeHtml(issue.type)}</strong>
        </div>
        <div class="detail-field">
          <span>Risk</span>
          <strong>${issue.risk}/100</strong>
        </div>
      </div>
      <pre class="handoff-preview">${escapeHtml(handoffNote())}</pre>
    </div>
  `;

  document.querySelector("#detail-owner").addEventListener("change", event => {
    issue.owner = event.target.value;
    persistBoard();
    render();
  });
  document.querySelector("#detail-status").addEventListener("change", event => {
    issue.status = event.target.value;
    persistBoard();
    render();
  });
}

function renderActivity() {
  const root = document.querySelector("#activity-chart");
  const max = Math.max(1, ...state.board.activity.flatMap(day => [day.issues, day.prs]));
  root.innerHTML = state.board.activity
    .map(day => {
      const issueHeight = Math.max(6, Math.round((day.issues / max) * 146));
      const prHeight = Math.max(6, Math.round((day.prs / max) * 146));
      return `
        <div class="bar-group">
          <div class="bars">
            <span class="bar issues" style="height:${issueHeight}px" title="${day.issues} issues"></span>
            <span class="bar prs" style="height:${prHeight}px" title="${day.prs} PRs"></span>
          </div>
          <span>${escapeHtml(day.day)}</span>
        </div>
      `;
    })
    .join("");
}

function renderRelease() {
  const root = document.querySelector("#release-checklist");
  const done = state.board.release.filter(item => item.done).length;
  const score = Math.round((done / state.board.release.length) * 100);
  document.querySelector("#release-score").textContent = `${score}%`;

  root.innerHTML = state.board.release
    .map(
      (item, index) => `
        <label class="check-item">
          <span>${escapeHtml(item.label)}</span>
          <input type="checkbox" data-release-index="${index}" ${item.done ? "checked" : ""}>
        </label>
      `
    )
    .join("");

  root.querySelectorAll("[data-release-index]").forEach(input => {
    input.addEventListener("change", () => {
      state.board.release[Number(input.dataset.releaseIndex)].done = input.checked;
      persistBoard();
      renderRelease();
      renderIssueDetail();
      renderMetrics();
    });
  });
}

function renderRisks() {
  const root = document.querySelector("#risk-grid");
  root.innerHTML = state.board.risks
    .map(
      risk => `
        <article class="risk-item">
          <div>
            <span class="severity">${escapeHtml(risk.severity)}</span>
            <p>${escapeHtml(risk.label)}</p>
          </div>
          <strong>${risk.count}</strong>
        </article>
      `
    )
    .join("");
}

function filteredIssues() {
  const query = state.filters.query.trim().toLowerCase();
  return [...state.board.issues]
    .filter(issue => state.filters.priority === "all" || issue.priority === state.filters.priority)
    .filter(issue => state.filters.owner === "all" || issue.owner === state.filters.owner)
    .filter(issue => state.filters.status === "all" || issue.status === state.filters.status)
    .filter(issue => !query || `${issue.title} ${issue.type} ${issue.owner} ${issue.status}`.toLowerCase().includes(query))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.risk - a.risk);
}

function computedMetrics() {
  const openIssues = state.board.issues.filter(issue => issue.status !== "Reviewed").length;
  const awaitingReview = state.board.issues.filter(issue => ["Review", "Needs repro", "Ready"].includes(issue.status)).length;
  const blockers = state.board.release.filter(item => !item.done).length;
  const response = state.board.metrics.find(metric => metric.label === "Median response") ?? { label: "Median response", value: "18h", delta: "local" };
  return [
    { label: "Open issues", value: openIssues, delta: `${state.board.issues.length} total` },
    { label: "PRs awaiting review", value: awaitingReview, delta: "triage view" },
    { label: "Release blockers", value: blockers, delta: blockers ? "needs work" : "ready" },
    response
  ];
}

function handoffNote() {
  const selected = selectedIssue();
  const blockers = state.board.release.filter(item => !item.done).map(item => item.label);
  const highRisk = state.board.issues.filter(issue => issue.risk >= 75 && issue.status !== "Reviewed");
  return [
    `# Maintainer handoff for ${state.board.project.repo}`,
    "",
    selected ? `Selected issue: #${selected.id} ${selected.title} (${selected.priority}, ${selected.status})` : "Selected issue: none",
    `Release blockers: ${blockers.length ? blockers.join(", ") : "none"}`,
    `High-risk open items: ${highRisk.length}`,
    `Open issues: ${computedMetrics()[0].value}`,
    `PRs awaiting review: ${computedMetrics()[1].value}`,
    "",
    "## Queue",
    ...filteredIssues().map(issue => `- #${issue.id} ${issue.priority} ${issue.title} - ${issue.status}, ${issue.owner}`)
  ].join("\n");
}

function exportBoardJson() {
  downloadFile("maintainer-ops-board.json", "application/json", `${JSON.stringify(state.board, null, 2)}\n`);
  showToast("Board JSON exported");
}

async function exportMarkdown() {
  const note = handoffNote();
  downloadFile("maintainer-handoff.md", "text/markdown", `${note}\n`);
  try {
    await navigator.clipboard.writeText(note);
    showToast("Markdown exported and copied");
  } catch {
    showToast("Markdown exported");
  }
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importBoard(file) {
  if (!file) {
    return;
  }
  try {
    const board = normalizeBoard(JSON.parse(await file.text()));
    state.board = board;
    state.selectedIssue = board.issues[0]?.id ?? null;
    state.filters = { query: "", priority: "all", owner: "all", status: "all" };
    persistBoard();
    render();
    showToast("Board JSON imported");
  } catch (error) {
    showToast(error.message);
  }
}

function normalizeBoard(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Board JSON must be an object");
  }
  for (const key of ["project", "metrics", "activity", "issues", "release", "risks"]) {
    if (candidate[key] === undefined) {
      throw new Error(`Board JSON missing ${key}`);
    }
  }
  if (!Array.isArray(candidate.issues) || !Array.isArray(candidate.release)) {
    throw new Error("Board JSON needs issue and release arrays");
  }
  return cloneBoard(candidate);
}

function cloneBoard(board) {
  return JSON.parse(JSON.stringify(board));
}

function loadStoredBoard() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeBoard(JSON.parse(stored)) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistBoard() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.board));
}

function selectedIssue() {
  return state.board.issues.find(issue => issue.id === state.selectedIssue);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

document.querySelector("#search").addEventListener("input", event => {
  state.filters.query = event.target.value;
  renderIssues();
});

document.querySelector("#priority-filter").addEventListener("change", event => {
  state.filters.priority = event.target.value;
  renderIssues();
  renderIssueDetail();
});

document.querySelector("#owner-filter").addEventListener("change", event => {
  state.filters.owner = event.target.value;
  renderIssues();
  renderIssueDetail();
});

document.querySelector("#status-filter").addEventListener("change", event => {
  state.filters.status = event.target.value;
  renderIssues();
  renderIssueDetail();
});

document.querySelector("#mark-reviewed").addEventListener("click", () => {
  const issue = selectedIssue();
  if (!issue) {
    showToast("No issue selected");
    return;
  }
  issue.status = "Reviewed";
  persistBoard();
  render();
  showToast(`#${issue.id} marked reviewed`);
});

document.querySelector("#export-markdown").addEventListener("click", exportMarkdown);
document.querySelector("#export-json").addEventListener("click", exportBoardJson);
document.querySelector("#import-json").addEventListener("click", () => document.querySelector("#board-file").click());
document.querySelector("#board-file").addEventListener("change", event => {
  importBoard(event.target.files[0]);
  event.target.value = "";
});
document.querySelector("#reset-board").addEventListener("click", () => {
  state.board = cloneBoard(state.baselineBoard);
  state.selectedIssue = state.board.issues[0]?.id ?? null;
  state.filters = { query: "", priority: "all", owner: "all", status: "all" };
  localStorage.removeItem(STORAGE_KEY);
  render();
  showToast("Board reset");
});

loadBoard().catch(error => {
  document.body.innerHTML = `<main class="load-error"><h1>Maintainer Ops Board</h1><p>${escapeHtml(error.message)}</p></main>`;
});
