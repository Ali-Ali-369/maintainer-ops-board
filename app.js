const state = {
  board: null,
  selectedIssue: null,
  filters: {
    query: "",
    priority: "all"
  }
};

const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };

async function loadBoard() {
  const response = await fetch("data/sample-board.json");
  if (!response.ok) {
    throw new Error(`Could not load board data: ${response.status}`);
  }
  state.board = await response.json();
  state.selectedIssue = state.board.issues[0]?.id ?? null;
  render();
}

function render() {
  renderProject();
  renderMetrics();
  renderIssues();
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
  root.innerHTML = state.board.metrics
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
      renderIssues();
    });
  });
}

function renderActivity() {
  const root = document.querySelector("#activity-chart");
  const max = Math.max(...state.board.activity.flatMap(day => [day.issues, day.prs]));
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
      renderRelease();
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
    .filter(issue => !query || `${issue.title} ${issue.type} ${issue.owner} ${issue.status}`.toLowerCase().includes(query))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.risk - a.risk);
}

function handoffNote() {
  const selected = state.board.issues.find(issue => issue.id === state.selectedIssue);
  const blockers = state.board.release.filter(item => !item.done).map(item => item.label);
  return [
    `Maintainer handoff for ${state.board.project.repo}`,
    selected ? `Selected issue: #${selected.id} ${selected.title} (${selected.priority}, ${selected.status})` : "Selected issue: none",
    `Release blockers: ${blockers.length ? blockers.join(", ") : "none"}`,
    `Open issues: ${state.board.metrics[0].value}`,
    `PRs awaiting review: ${state.board.metrics[1].value}`
  ].join("\n");
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
});

document.querySelector("#mark-reviewed").addEventListener("click", () => {
  const issue = state.board.issues.find(item => item.id === state.selectedIssue);
  if (!issue) {
    showToast("No issue selected");
    return;
  }
  issue.status = "Reviewed";
  renderIssues();
  showToast(`#${issue.id} marked reviewed`);
});

document.querySelector("#export-note").addEventListener("click", async () => {
  const note = handoffNote();
  try {
    await navigator.clipboard.writeText(note);
    showToast("Handoff note copied");
  } catch {
    showToast(note);
  }
});

loadBoard().catch(error => {
  document.body.innerHTML = `<main class="load-error"><h1>Maintainer Ops Board</h1><p>${escapeHtml(error.message)}</p></main>`;
});
