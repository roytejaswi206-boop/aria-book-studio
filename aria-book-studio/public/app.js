const API = "";

const state = {
  route: location.hash.replace("#", "") || "/",
  books: [],
  activeBook: null,
  activeChapterId: null,
  activeTab: "overview",
  filter: "all",
  sort: "recent",
  search: "",
  jobs: [],
  debugOpen: false,
  debug: null,
  toast: [],
  chapterPage: 0,
  chapterPageSize: 80,
  chapterTotal: 0,
  chapterSearch: "",
  selectedChapter: null,
  analytics: null,
  memoryGraph: null,
  universes: [],
  episodes: null,
  retention: null,
  marketing: [],
  research: null,
  kdp: null,
  distribution: null,
  quality: null,
  recommendations: null,
  monetization: null,
  workers: [],
  devops: null,
  profile: null,
  aiCatalog: null,
  aiTestResult: null,
  episodePage: 0,
  episodePageSize: 80
};

const blackthornPrompt = `Every year, on the same date, someone dies in the exact same way inside the elite Blackthorn Academy.

The victims are always different. The crime scene is always identical. Every body has the same final message carved nearby:

"Evelyn remembers."

Seventeen-year-old Adrian Vale transfers to Blackthorn after his brother's mysterious suicide. On his very first night, he witnesses a girl falling from the academy clocktower, only for her to appear alive the next morning with no memory of the incident.

Her name is Evelyn Cross.

Beautiful. Isolated. Feared.

As Adrian gets closer to her, he uncovers terrifying secrets hidden beneath the academy: underground tunnels, erased student records, illegal memory experiments, and a forbidden society obsessed with immortality through consciousness transfer.

Soon Adrian realizes Evelyn has died six times before, and every death resets part of reality itself.

Each reset changes small details in the world: photographs alter overnight, friendships disappear, students forget entire years, and some people return from the dead with different personalities.

But the seventh death is approaching. And this time, reality itself may not survive the reset.`;

function $(selector, root = document) {
  return root.querySelector(selector);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API failed: ${path}`);
  return data;
}

async function loadAiSettings() {
  const [catalog, profile] = await Promise.all([
    api("/api/ai/models"),
    api("/api/profile")
  ]);
  state.aiCatalog = catalog;
  state.profile = profile;
  return { catalog, profile };
}

function toast(message) {
  const id = crypto.randomUUID();
  state.toast.push({ id, message });
  renderToast();
  setTimeout(() => {
    state.toast = state.toast.filter(t => t.id !== id);
    renderToast();
  }, 3600);
}

function navigate(route) {
  location.hash = route;
}

window.addEventListener("hashchange", () => {
  state.route = location.hash.replace("#", "") || "/";
  render();
});

document.addEventListener("keydown", event => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    state.debugOpen = !state.debugOpen;
    refreshDebug();
    renderDebug();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    const action = prompt("Command: new, library, settings, export, debug");
    if (action === "new") createBlackthornBook();
    if (action === "library") navigate("/");
    if (action === "settings") navigate("/settings");
    if (action === "debug") {
      state.debugOpen = true;
      refreshDebug();
      renderDebug();
    }
    if (action === "export" && state.activeBook) state.activeTab = "export";
    render();
  }
});

async function loadBooks() {
  state.books = await api("/api/books");
}

async function loadBook(id, options = {}) {
  const offset = state.chapterPage * state.chapterPageSize;
  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(state.chapterPageSize),
    q: state.chapterSearch
  });
  const [book, chapterPage, analytics, memoryGraph] = await Promise.all([
    api(`/api/books/${id}?light=1`),
    api(`/api/books/${id}/chapters?${query}`),
    api(`/api/books/${id}/analytics`).catch(() => null),
    api(`/api/books/${id}/memory-graph`).catch(() => null)
  ]);
  await loadAiSettings().catch(() => {});
  state.activeBook = { ...book, chapters: chapterPage.items };
  state.chapterTotal = chapterPage.total;
  state.analytics = analytics;
  state.memoryGraph = memoryGraph;
  await loadEntertainmentSystems(id).catch(() => {});
  if (!state.activeChapterId && chapterPage.items[0]) state.activeChapterId = chapterPage.items[0].id;
  if (options.loadSelected !== false && state.activeChapterId && !isEditorFocused()) {
    await loadChapter(state.activeChapterId).catch(() => {});
  }
}

async function loadEntertainmentSystems(bookId) {
  const episodeOffset = state.episodePage * state.episodePageSize;
  const [universes, episodes, retention, marketing] = await Promise.all([
    api("/api/universes").catch(() => []),
    api(`/api/books/${bookId}/episodes?offset=${episodeOffset}&limit=${state.episodePageSize}`).catch(() => ({ items: [], total: 0 })),
    api(`/api/books/${bookId}/retention`).catch(() => null),
    api(`/api/books/${bookId}/marketing`).catch(() => [])
  ]);
  state.universes = universes;
  state.episodes = episodes;
  state.retention = retention;
  state.marketing = marketing;
  const [research, kdp, distribution, quality, recommendations, monetization, workers, devops] = await Promise.all([
    api(`/api/books/${bookId}/research`).catch(() => null),
    api(`/api/books/${bookId}/kdp-package`).catch(() => null),
    api(`/api/books/${bookId}/distribution-plan`).catch(() => null),
    api(`/api/books/${bookId}/quality-governor`).catch(() => null),
    api(`/api/books/${bookId}/recommendations`).catch(() => null),
    api(`/api/books/${bookId}/monetization`).catch(() => null),
    api("/api/workers/status").catch(() => []),
    api("/api/devops/status").catch(() => null)
  ]);
  Object.assign(state, { research, kdp, distribution, quality, recommendations, monetization, workers, devops });
}

async function loadChapter(id) {
  state.selectedChapter = await api(`/api/chapters/${id}`);
  state.activeChapterId = id;
}

function isEditorFocused() {
  return ["chapter-content", "chapter-title"].includes(document.activeElement?.id);
}

async function refreshActiveJobs() {
  state.jobs = await api("/api/jobs/active/local-user").catch(() => []);
  renderStickyJob();
}

async function refreshDebug() {
  if (!state.debugOpen) return;
  const [debug, engineering] = await Promise.all([
    api("/api/debug").catch(err => ({ error: err.message })),
    api("/api/engineering/dashboard").catch(err => ({ error: err.message }))
  ]);
  state.debug = { debug, engineering };
  renderDebug();
}

function startPollers() {
  setInterval(async () => {
    await refreshActiveJobs();
    const routeBook = state.route.match(/^\/book\/([^/]+)/);
    if (routeBook && !isEditorFocused()) {
      await loadBook(routeBook[1], { loadSelected: false }).catch(() => {});
      renderWorkspace();
    }
  }, 3000);
  setInterval(refreshDebug, 3000);
}

async function createBlackthornBook() {
  const book = await api("/api/books", {
    method: "POST",
    body: JSON.stringify({
      title: "Evelyn Remembers",
      subtitle: "A Blackthorn Academy Thriller",
      tagline: "Every death resets the truth.",
      authorName: "Tejaswi Roy",
      bookTypes: ["Novel", "Thriller", "Mystery", "Horror"],
      genres: ["Dark Academia", "Psychological Thriller", "Romance", "Speculative Mystery"],
      tones: ["Dark", "Suspenseful", "Romantic", "Cinematic"],
      writingStyles: ["Literary", "Fast-paced", "Atmospheric"],
      audience: ["Young Adults", "Adults"],
      targetChapters: getAutopilotChapterTarget(),
      description: blackthornPrompt,
      userCustomPrompt: blackthornPrompt
    })
  });
  localStorage.setItem("lastBookId", book.id);
  toast("Book project created");
  navigate(`/book/${book.id}`);
  await startGeneration(book.id);
}

function getAutopilotChapterTarget() {
  const input = $("#autopilot-chapters");
  const parsed = Number.parseInt(input?.value || "1000", 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 1000;
}

async function startGeneration(bookId) {
  const result = await api("/api/jobs/start", {
    method: "POST",
    body: JSON.stringify({ bookId })
  });
  localStorage.setItem(`job_${bookId}`, result.jobId);
  toast("Generation started in background");
  await refreshActiveJobs();
}

async function controlJob(jobId, action) {
  await api(`/api/jobs/${jobId}/${action}`, { method: "POST", body: "{}" });
  toast(`Job ${action} requested`);
  await refreshActiveJobs();
  if (state.activeBook) await loadBook(state.activeBook.id, { loadSelected: false });
  renderWorkspace();
}

async function deleteBook(id) {
  if (!confirm("Delete this book and all chapters?")) return;
  await api(`/api/books/${id}`, { method: "DELETE" });
  toast("Book deleted");
  await loadBooks();
  render();
}

function progress(book) {
  const total = Number(book.totalChapters || book.targetChapters || 0);
  if (!total) return 0;
  return Math.min(100, Math.round((Number(book.completedChapters || 0) / total) * 100));
}

function wordCount(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function render() {
  const app = $("#app");
  app.innerHTML = `
    <div class="app-shell">
      ${nav()}
      <main id="main"></main>
      <div id="sticky"></div>
      <div id="debug" class="debug-panel"></div>
      <div id="toast" class="toast"></div>
    </div>
  `;
  if (state.route === "/settings") {
    renderSettings().catch(err => {
      $("#main").innerHTML = `<section class="container"><div class="panel">Could not load settings: ${escapeHtml(err.message)}</div></section>`;
    });
  } else if (state.route.startsWith("/book/")) {
    const id = state.route.split("/")[2];
    loadBook(id).then(() => renderWorkspace()).catch(err => {
      $("#main").innerHTML = `<section class="container"><div class="panel">Book not found: ${escapeHtml(err.message)}</div></section>`;
    });
  } else {
    loadBooks().then(renderLibrary).catch(err => {
      $("#main").innerHTML = `<section class="container"><div class="panel">Could not load library: ${escapeHtml(err.message)}</div></section>`;
    });
  }
  renderStickyJob();
  renderDebug();
  renderToast();
}

function nav() {
  return `
    <header class="nav">
      <div class="brand" onclick="navigate('/')" role="button" tabindex="0">
        <div class="brand-mark">A</div>
        <div>
          <h1>ARIA Book Studio</h1>
          <span>Autonomous publishing workspace</span>
        </div>
      </div>
      <div class="nav-actions">
        <button class="nav-link" onclick="navigate('/')">Library</button>
        <button class="nav-link" onclick="navigate('/settings')">Settings</button>
        <button class="nav-link" onclick="createBlackthornBook()">New Blackthorn Book</button>
        <button class="btn primary" onclick="createBlackthornBook()">Autopilot Book Mode</button>
      </div>
    </header>
  `;
}

async function renderSettings() {
  $("#main").innerHTML = `<section class="container"><div class="panel empty">Loading AI Engine settings...</div></section>`;
  await loadAiSettings();
  const profile = state.profile || {};
  const ai = profile.ai || {};
  const provider = ai.provider || state.aiCatalog.defaultProvider;
  const model = ai.model || state.aiCatalog.defaultModel;
  const lastTest = ai.lastTest;
  $("#main").innerHTML = `
    <section class="container">
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="eyebrow">Profile Settings</div>
          <h2 class="page-title" style="font-size:clamp(36px,6vw,68px)">AI Engine</h2>
          <p class="lead">Choose the model that powers planning, drafting, research, and rewrite workflows across ARIA OS.</p>
        </div>
        <button class="btn" onclick="navigate('/')">Back to Library</button>
      </div>

      <div class="settings-layout">
        <article class="panel">
          <h3>Profile</h3>
          <div class="form-grid two">
            <label>Full Name<input id="settings-full-name" class="input" value="${escapeHtml(profile.fullName || "")}"></label>
            <label>Author Name<input id="settings-author-name" class="input" value="${escapeHtml(profile.authorName || "")}"></label>
          </div>
          <label>Bio<textarea id="settings-bio" class="textarea" style="min-height:120px">${escapeHtml(profile.bio || "")}</textarea></label>
          <label>App Language
            <select id="settings-language" class="select">
              ${[["en", "English"], ["hi", "Hindi"], ["hinglish", "Hinglish"]].map(([value, label]) => `<option value="${value}" ${(profile.preferredLanguage || "en") === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
        </article>

        <article class="panel ai-engine-panel">
          <div class="row" style="justify-content:space-between">
            <div>
              <h3>AI Engine</h3>
              <p class="muted">Provider keys are sealed locally and never returned to the browser.</p>
            </div>
            <span class="pill ${ai.hasApiKey ? "good" : "warn"}">${ai.hasApiKey ? "key saved" : "key needed"}</span>
          </div>

          <input type="hidden" id="settings-provider" value="${escapeHtml(provider)}">
          <div class="provider-grid">
            ${providerCards("settings", provider)}
          </div>

          <div class="form-grid two">
            <label>Model
              <select id="settings-model" class="select" onchange="updateAiModelSelect('settings')">
                ${modelOptions(provider, model)}
              </select>
            </label>
            <label>API Key
              <div class="secret-row">
                <input id="settings-api-key" class="input" type="password" placeholder="${ai.hasApiKey ? "Saved key available" : "Paste provider API key"}">
                <button class="btn" type="button" onclick="toggleSecret('settings-api-key')">Show</button>
              </div>
            </label>
          </div>

          <div id="settings-model-info" class="model-summary">${modelSummary(provider, model)}</div>
          ${lastTest ? `<p class="muted">Last test: ${escapeHtml(lastTest.message)} (${new Date(lastTest.checkedAt).toLocaleString()})</p>` : ""}
          <div id="settings-test-result">${testResultHtml(state.aiTestResult)}</div>

          <div class="button-row">
            <button class="btn" onclick="testAiSettings()">Test Connection</button>
            <button class="btn primary" onclick="saveAiSettings()">Save AI Settings</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

function providerCards(prefix, selectedProvider) {
  const providers = state.aiCatalog?.providers || {};
  return Object.entries(providers).map(([id, provider]) => `
    <label class="provider-card ${selectedProvider === id ? "active" : ""}" data-provider-card="${prefix}" data-provider="${id}">
      <input type="radio" name="${prefix}-provider-radio" value="${id}" ${selectedProvider === id ? "checked" : ""} onchange="selectAiProvider('${prefix}', '${id}')">
      <b>${escapeHtml(provider.label)}</b>
      <span>${escapeHtml(provider.models.find(model => model.id === provider.defaultModel)?.label || provider.defaultModel)}</span>
    </label>
  `).join("");
}

function modelOptions(providerId, selectedModel) {
  const provider = state.aiCatalog?.providers?.[providerId] || {};
  return (provider.models || []).map(model => `<option value="${model.id}" ${selectedModel === model.id ? "selected" : ""}>${escapeHtml(model.label)}${model.recommended ? " - Default" : ""}</option>`).join("");
}

function modelSummary(providerId, modelId) {
  const model = state.aiCatalog?.providers?.[providerId]?.models?.find(item => item.id === modelId);
  if (!model) return "";
  return `
    <span class="pill">Speed: ${escapeHtml(model.speed)}</span>
    <span class="pill">Power: ${escapeHtml(model.power)}</span>
    <span class="pill">Cost: ${escapeHtml(model.cost)}</span>
  `;
}

function selectAiProvider(prefix, providerId) {
  const providerInput = $(`#${prefix}-provider`);
  if (providerInput) providerInput.value = providerId;
  document.querySelectorAll(`[data-provider-card="${prefix}"]`).forEach(card => {
    card.classList.toggle("active", card.dataset.provider === providerId);
  });
  updateAiModelSelect(prefix);
}

function updateAiModelSelect(prefix) {
  const providerId = $(`#${prefix}-provider`)?.value || state.aiCatalog?.defaultProvider;
  const modelSelect = $(`#${prefix}-model`);
  const provider = state.aiCatalog?.providers?.[providerId];
  if (!modelSelect || !provider) return;
  const current = modelSelect.value;
  const selected = provider.models.some(model => model.id === current) ? current : provider.defaultModel;
  modelSelect.innerHTML = modelOptions(providerId, selected);
  modelSelect.value = selected;
  const summary = $(`#${prefix}-model-info`);
  if (summary) summary.innerHTML = modelSummary(providerId, selected);
}

function toggleSecret(id) {
  const input = $(`#${id}`);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

async function saveAiSettings() {
  const payload = {
    fullName: $("#settings-full-name")?.value || "",
    authorName: $("#settings-author-name")?.value || "",
    bio: $("#settings-bio")?.value || "",
    preferredLanguage: $("#settings-language")?.value || "en",
    provider: $("#settings-provider")?.value,
    model: $("#settings-model")?.value,
    apiKey: $("#settings-api-key")?.value || ""
  };
  state.profile = await api("/api/profile/ai-settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.aiTestResult = null;
  toast("AI settings saved");
  await renderSettings();
}

async function testAiSettings() {
  const payload = {
    provider: $("#settings-provider")?.value,
    model: $("#settings-model")?.value,
    apiKey: $("#settings-api-key")?.value || ""
  };
  state.aiTestResult = await api("/api/settings/test-ai", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  await loadAiSettings();
  renderSettings();
}

function testResultHtml(result) {
  if (!result) return "";
  return `<div class="connection-result ${result.ok ? "ok" : "bad"}">${escapeHtml(result.message || (result.ok ? "Connection verified." : "Connection failed."))}</div>`;
}

function renderLibrary() {
  const books = filteredBooks();
  const totalWords = state.books.reduce((sum, b) => sum + Number(b.totalWords || 0), 0);
  $("#main").innerHTML = `
    <section class="container">
      <div class="hero">
        <div class="hero-copy">
          <div class="eyebrow">AI Publishing Operating System</div>
          <h2 class="page-title">Build books that feel published.</h2>
          <p class="lead">Plan, generate, edit, preview, and export cinematic books with codex memory, background jobs, quality scoring, and print-style formatting.</p>
          <label class="chapter-target">
            <span>Autopilot chapter target</span>
            <input id="autopilot-chapters" class="input" type="number" min="1000" step="100" value="1000">
            <small>No upper limit. Minimum is 1000 chapters.</small>
          </label>
          <div class="button-row">
            <button class="btn primary" onclick="createBlackthornBook()">Create 1000+ Chapter Book</button>
            <button class="btn" onclick="state.debugOpen=true; refreshDebug(); renderDebug()">Open Debug Panel</button>
          </div>
        </div>
        <div class="book-cover">
          <div class="cover-kicker">Dark Academia</div>
          <div style="font-size:84px;text-align:center;margin-top:35%">🕰️</div>
          <div class="cover-title">Evelyn Remembers</div>
          <div class="cover-author">Tejaswi Roy</div>
        </div>
      </div>

      <div class="grid stats">
        <div class="card stat"><span class="muted">Total Books</span><b>${state.books.length}</b></div>
        <div class="card stat"><span class="muted">Total Words</span><b>${totalWords.toLocaleString()}</b></div>
        <div class="card stat"><span class="muted">In Progress</span><b>${state.books.filter(b => b.status === "generating").length}</b></div>
        <div class="card stat"><span class="muted">Completed</span><b>${state.books.filter(b => b.status === "complete").length}</b></div>
      </div>

      <div class="filters">
        <input class="input" placeholder="Search your library..." value="${escapeHtml(state.search)}" oninput="state.search=this.value; renderLibrary()">
        <select class="select" onchange="state.filter=this.value; renderLibrary()">
          ${["all", "draft", "generating", "complete"].map(v => `<option value="${v}" ${state.filter === v ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}
        </select>
        <select class="select" onchange="state.sort=this.value; renderLibrary()">
          ${[["recent", "Recent"], ["az", "A-Z"], ["words", "Most Words"]].map(([v, label]) => `<option value="${v}" ${state.sort === v ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>

      ${books.length ? `<div class="grid cards">${books.map(bookCard).join("")}</div>` : emptyState()}
    </section>
  `;
}

function filteredBooks() {
  let books = [...state.books];
  if (state.filter !== "all") books = books.filter(b => b.status === state.filter);
  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    books = books.filter(b => `${b.title} ${b.authorName} ${(b.genres || []).join(" ")}`.toLowerCase().includes(q));
  }
  if (state.sort === "az") books.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === "words") books.sort((a, b) => Number(b.totalWords || 0) - Number(a.totalWords || 0));
  return books;
}

function bookCard(book) {
  const pct = progress(book);
  const statusClass = book.status === "complete" ? "good" : book.status === "generating" ? "warn" : "";
  return `
    <article class="card book-card">
      ${coverMini(book)}
      <div>
        <div class="row" style="justify-content:space-between">
          <span class="pill ${statusClass}">${book.status}</span>
          <span class="muted">${new Date(book.updatedAt).toLocaleDateString()}</span>
        </div>
        <h3 class="book-title" style="font-size:26px;margin:12px 0 4px">${escapeHtml(book.title)}</h3>
        <div class="muted">${escapeHtml(book.authorName || "")}</div>
        <p>${(book.genres || []).slice(0, 3).map(g => `<span class="pill">${escapeHtml(g)}</span>`).join(" ")}</p>
        <div class="progress" title="${pct}%"><span style="--value:${pct}%"></span></div>
        <p class="muted">${pct}% • Ch ${book.completedChapters || 0}/${book.totalChapters || book.targetChapters || 0} • ${(book.totalWords || 0).toLocaleString()} words</p>
        <div class="button-row">
          <button class="btn primary" onclick="navigate('/book/${book.id}')">${book.status === "complete" ? "Open" : "Continue"}</button>
          <button class="btn" onclick="quickExport('${book.id}', 'txt')">Export TXT</button>
          <button class="btn danger" onclick="deleteBook('${book.id}')">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function coverMini(book) {
  return `
    <div class="cover-mini">
      <div class="cover-kicker">${escapeHtml((book.genres || ["ARIA"])[0])}</div>
      <div style="font-size:30px;text-align:center;margin-top:25px">🕰️</div>
      <div class="cover-title">${escapeHtml(book.title || "")}</div>
      <div class="cover-author">${escapeHtml(book.authorName || "")}</div>
    </div>
  `;
}

function emptyState() {
  return `
    <div class="panel empty">
      <div style="font-size:54px">📚</div>
      <h2 class="book-title">Start your first book</h2>
      <p class="muted">ARIA will create the plan, codex, chapters, preview, and export package.</p>
      <button class="btn primary" onclick="createBlackthornBook()">Create 1000+ Chapter Book</button>
    </div>
  `;
}

function renderWorkspace() {
  const book = state.activeBook;
  if (!book) return;
  const tabs = ["overview", "research", "chapters", "codex", "storyverse", "episodes", "intelligence", "governor", "publishing", "devops", "marketing", "cover", "preview", "export"];
  $("#main").innerHTML = `
    <section class="container">
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="eyebrow">${escapeHtml(book.status)}</div>
          <h2 class="page-title" style="font-size:clamp(36px,6vw,72px)">${escapeHtml(book.title)}</h2>
          <p class="lead">${escapeHtml(book.tagline || book.subtitle || "")}</p>
        </div>
        <div class="button-row">
          <button class="btn" onclick="startGeneration('${book.id}')">Continue Generation</button>
          <button class="btn primary" onclick="state.activeTab='export'; renderWorkspace()">Export</button>
        </div>
      </div>
      <div class="tabs">
        ${tabs.map(t => `<button class="tab ${state.activeTab === t ? "active" : ""}" onclick="state.activeTab='${t}'; renderWorkspace()">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
      </div>
      <div id="tab-content">${tabContent(book)}</div>
    </section>
  `;
}

function tabContent(book) {
  if (state.activeTab === "overview") return overviewTab(book);
  if (state.activeTab === "research") return researchTab(book);
  if (state.activeTab === "chapters") return chaptersTab(book);
  if (state.activeTab === "codex") return codexTab(book);
  if (state.activeTab === "storyverse") return storyverseTab(book);
  if (state.activeTab === "episodes") return episodesTab(book);
  if (state.activeTab === "intelligence") return intelligenceTab(book);
  if (state.activeTab === "governor") return governorTab(book);
  if (state.activeTab === "publishing") return publishingTab(book);
  if (state.activeTab === "devops") return devopsTab(book);
  if (state.activeTab === "marketing") return marketingTab(book);
  if (state.activeTab === "cover") return coverTab(book);
  if (state.activeTab === "preview") return previewTab(book);
  if (state.activeTab === "export") return exportTab(book);
  return "";
}

function overviewTab(book) {
  const pct = progress(book);
  const analytics = state.analytics;
  return `
    <div class="grid stats">
      <div class="card stat"><span class="muted">Progress</span><b>${pct}%</b></div>
      <div class="card stat"><span class="muted">Chapters</span><b>${book.completedChapters || 0}/${book.totalChapters || book.targetChapters || 0}</b></div>
      <div class="card stat"><span class="muted">Words</span><b>${(book.totalWords || 0).toLocaleString()}</b></div>
      <div class="card stat"><span class="muted">Codex</span><b>${(book.codexEntries || []).length}</b></div>
    </div>
    ${analytics ? `
      <div class="grid stats" style="margin-top:16px">
        <div class="card stat"><span class="muted">Production Readiness</span><b>${analytics.productionReadiness}%</b></div>
        <div class="card stat"><span class="muted">Human Score</span><b>${analytics.avgHuman}</b></div>
        <div class="card stat"><span class="muted">Quality Score</span><b>${analytics.avgQuality}</b></div>
        <div class="card stat"><span class="muted">Est. Pages</span><b>${analytics.estimatedPages}</b></div>
      </div>
    ` : ""}
    <div class="panel" style="margin-top:16px">
      <h3>Autopilot Status</h3>
      <div class="progress"><span style="--value:${pct}%"></span></div>
      <p class="lead">${escapeHtml(book.description || "")}</p>
      <div class="button-row">
        <button class="btn primary" onclick="startGeneration('${book.id}')">Run / Resume Generation</button>
        ${activeJobButtons(book.id)}
        <button class="btn" onclick="state.activeTab='preview'; renderWorkspace()">Read Preview</button>
      </div>
      ${analytics?.warnings?.length ? `<div class="warning-list">${analytics.warnings.map(w => `<span class="pill warn">${escapeHtml(w)}</span>`).join("")}</div>` : ""}
    </div>
    ${projectAiPanel(book)}
  `;
}

function projectAiPanel(book) {
  if (!state.aiCatalog || !state.profile) {
    return `
      <div class="panel" style="margin-top:16px">
        <h3>Project AI Engine</h3>
        <p class="muted">Open settings once to load provider and model options.</p>
        <button class="btn" onclick="navigate('/settings')">Open AI Settings</button>
      </div>
    `;
  }
  const inherited = state.profile.ai || {};
  const provider = book.aiProviderOverride || inherited.provider || state.aiCatalog.defaultProvider;
  const model = book.aiModelOverride || inherited.model || state.aiCatalog.defaultModel;
  const inheritedLabel = `${state.aiCatalog.providers?.[inherited.provider]?.label || inherited.provider || "Anthropic"} / ${inherited.model || state.aiCatalog.defaultModel}`;
  return `
    <div class="panel project-ai-panel" style="margin-top:16px">
      <div class="row" style="justify-content:space-between">
        <div>
          <h3>Project AI Engine</h3>
          <p class="muted">Override the global engine for this book only. Inherited: ${escapeHtml(inheritedLabel)}</p>
        </div>
        <span class="pill ${book.aiProviderOverride ? "good" : ""}">${book.aiProviderOverride ? "custom engine" : "using profile default"}</span>
      </div>
      <input type="hidden" id="project-ai-provider" value="${escapeHtml(provider)}">
      <div class="provider-grid compact">
        ${providerCards("project-ai", provider)}
      </div>
      <div class="form-grid two">
        <label>Model
          <select id="project-ai-model" class="select" onchange="updateAiModelSelect('project-ai')">
            ${modelOptions(provider, model)}
          </select>
        </label>
        <div>
          <div id="project-ai-model-info" class="model-summary">${modelSummary(provider, model)}</div>
          <div id="project-ai-test-result">${testResultHtml(state.aiTestResult)}</div>
        </div>
      </div>
      <div class="button-row">
        <button class="btn" onclick="testProjectAiOverride('${book.id}')">Test Project Engine</button>
        <button class="btn primary" onclick="saveProjectAiOverride('${book.id}')">Save Project Override</button>
      </div>
    </div>
  `;
}

async function saveProjectAiOverride(bookId) {
  const provider = $("#project-ai-provider")?.value || state.profile?.ai?.provider;
  const model = $("#project-ai-model")?.value || state.profile?.ai?.model;
  const updated = await api(`/api/books/${bookId}`, {
    method: "PUT",
    body: JSON.stringify({ aiProviderOverride: provider, aiModelOverride: model })
  });
  state.activeBook = { ...state.activeBook, ...updated };
  toast("Project AI override saved");
  renderWorkspace();
}

async function testProjectAiOverride(bookId) {
  state.aiTestResult = await api("/api/settings/test-ai", {
    method: "POST",
    body: JSON.stringify({
      provider: $("#project-ai-provider")?.value,
      model: $("#project-ai-model")?.value
    })
  });
  if (state.activeBook?.id === bookId) renderWorkspace();
}

function activeJobButtons(bookId) {
  const job = state.jobs.find(j => j.bookId === bookId);
  if (!job) return "";
  return `
    <button class="btn" onclick="controlJob('${job.id}', 'pause')">Pause</button>
    <button class="btn" onclick="controlJob('${job.id}', 'resume')">Resume</button>
    <button class="btn danger" onclick="controlJob('${job.id}', 'cancel')">Cancel</button>
  `;
}

function researchTab(book) {
  const research = state.research;
  if (!research) return `<div class="panel empty">Research engine is preparing market intelligence.</div>`;
  const report = research.report || {};
  return `
    <div class="grid cards">
      <article class="card research-hero">
        <span class="pill good">Global Research Engine</span>
        <h3>${escapeHtml(report.title || "Market Opportunity Report")}</h3>
        <div class="readiness-ring" style="--score:${(report.opportunityScore || 0) * 3.6}deg"><b>${report.opportunityScore || 0}</b></div>
        <p>${escapeHtml(report.audienceDemand || "")}</p>
        <p class="muted">${escapeHtml(report.positioning || "")}</p>
        <button class="btn primary" onclick="refreshResearch()">Run Fresh Research</button>
      </article>
      <article class="card">
        <h3>Research Agents</h3>
        <div class="agent-list">
          ${(research.agents || []).map(agent => `
            <div class="agent-row">
              <div><b>${escapeHtml(agent.name)}</b><div class="muted">${escapeHtml(agent.purpose)}</div></div>
              <span class="pill good">${agent.status}</span>
            </div>
          `).join("")}
        </div>
      </article>
      <article class="card">
        <h3>Trend Analysis</h3>
        ${(research.trends || []).map(trend => `
          <div class="trend-row">
            <div class="row" style="justify-content:space-between"><b>${escapeHtml(trend.name)}</b><span class="pill">${trend.direction}</span></div>
            <div class="progress"><span style="--value:${trend.score}%"></span></div>
          </div>
        `).join("")}
      </article>
      <article class="card">
        <h3>Research Sources</h3>
        ${(research.sources || []).map(source => `<div class="clue"><b>${escapeHtml(source.name)}</b><p class="muted">${escapeHtml(source.insight)}</p><span class="pill">Confidence ${source.confidence}</span></div>`).join("")}
      </article>
    </div>
  `;
}

async function refreshResearch() {
  state.research = await api(`/api/books/${state.activeBook.id}/research`, { method: "POST", body: "{}" });
  toast("Fresh research report generated");
  renderWorkspace();
}

function chaptersTab(book) {
  const chapters = book.chapters || [];
  const selected = state.selectedChapter || chapters.find(c => c.id === state.activeChapterId) || chapters[0];
  if (!selected) return `<div class="panel empty"><h3>No chapters yet</h3><p class="muted">Start generation and chapters will appear live.</p><button class="btn primary" onclick="startGeneration('${book.id}')">Start Generation</button></div>`;
  state.activeChapterId = selected.id;
  const start = state.chapterPage * state.chapterPageSize + 1;
  const end = Math.min(state.chapterTotal, start + chapters.length - 1);
  return `
    <div class="workspace">
      <aside class="panel">
        <div class="row" style="justify-content:space-between;margin-bottom:12px">
          <b>Chapters</b>
          <span class="pill">${start}-${end} of ${state.chapterTotal}</span>
        </div>
        <div class="chapter-tools">
          <input class="input" id="chapter-search" placeholder="Search chapters..." value="${escapeHtml(state.chapterSearch)}" onkeydown="if(event.key==='Enter') applyChapterSearch()">
          <div class="button-row">
            <button class="btn" onclick="moveChapterPage(-1)">Prev</button>
            <button class="btn" onclick="applyChapterSearch()">Search</button>
            <button class="btn" onclick="moveChapterPage(1)">Next</button>
          </div>
        </div>
        <div class="chapter-list">
          ${chapters.map(c => `
            <button class="chapter-item ${c.id === selected.id ? "active" : ""}" onclick="selectChapter('${c.id}')">
              <b>${c.chapterNumber}. ${escapeHtml(c.title)}</b>
              <div class="muted">${c.status} • ${c.wordCount || 0} words • Q${c.qualityScore || 0}</div>
            </button>
          `).join("")}
        </div>
      </aside>
      <section class="panel">
        <div class="row" style="justify-content:space-between">
          <input class="input" id="chapter-title" value="${escapeHtml(selected.title)}" style="max-width:520px">
          <div class="row"><span class="pill good">Human ${selected.humanScore || 0}</span><span class="pill good">Quality ${selected.qualityScore || 0}</span></div>
        </div>
        <textarea class="textarea editor" id="chapter-content">${escapeHtml(selected.content)}</textarea>
        <div class="row" style="justify-content:space-between;margin-top:12px">
          <span class="muted" id="live-count">${wordCount(selected.content)} words</span>
          <div class="button-row">
            <button class="btn" onclick="saveChapter('${selected.id}')">Save</button>
            <button class="btn" onclick="improveChapter()">Improve</button>
            <button class="btn" onclick="copyChapter()">Copy</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

async function selectChapter(id) {
  await loadChapter(id);
  renderWorkspace();
}

async function applyChapterSearch() {
  state.chapterSearch = $("#chapter-search")?.value || "";
  state.chapterPage = 0;
  state.selectedChapter = null;
  await loadBook(state.activeBook.id);
  renderWorkspace();
}

async function moveChapterPage(direction) {
  const maxPage = Math.max(0, Math.ceil(state.chapterTotal / state.chapterPageSize) - 1);
  state.chapterPage = Math.max(0, Math.min(maxPage, state.chapterPage + direction));
  state.selectedChapter = null;
  state.activeChapterId = null;
  await loadBook(state.activeBook.id);
  renderWorkspace();
}

async function saveChapter(id) {
  const title = $("#chapter-title").value;
  const content = $("#chapter-content").value;
  const saved = await api(`/api/chapters/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title, content })
  });
  state.selectedChapter = saved;
  toast("Chapter saved");
  await loadBook(saved.bookId, { loadSelected: false });
  renderWorkspace();
}

function improveChapter() {
  const editor = $("#chapter-content");
  editor.value = editor.value
    .replace(/\bvery\b/gi, "dangerously")
    .replace(/\bthings\b/gi, "details")
    .trim() + "\n\nThe academy seemed quieter after that, which Adrian had learned was never mercy. It was preparation.";
  toast("Chapter improved locally");
}

function copyChapter() {
  navigator.clipboard.writeText($("#chapter-content").value);
  toast("Chapter copied");
}

function codexTab(book) {
  const entries = book.codexEntries || [];
  return `
    <div class="grid cards">
      ${entries.map(e => `
        <article class="card">
          <span class="pill">${escapeHtml(e.type)}</span>
          <h3>${escapeHtml(e.name)}</h3>
          <p class="muted">${escapeHtml(e.description)}</p>
        </article>
      `).join("") || `<div class="panel empty">Codex appears after generation starts.</div>`}
    </div>
  `;
}

function storyverseTab(book) {
  const universe = state.universes.find(u => u.id === book.universeId) || state.universes[0];
  return `
    <div class="grid cards">
      <article class="card storyverse-card">
        <span class="pill good">Universe</span>
        <h3>${escapeHtml(universe?.name || "The Blackthorn Reality")}</h3>
        <p class="muted">${escapeHtml(universe?.logline || "A connected entertainment franchise layer for books, spin-offs, timelines, and alternate realities.")}</p>
        <div class="storyverse-map">
          <div>Prime Book</div>
          <div>Before Evelyn</div>
          <div>Blackthorn Origins</div>
          <div>Adrian Files</div>
          <div>Timeline Zero</div>
        </div>
      </article>
      <article class="card">
        <h3>Franchise Architecture</h3>
        ${[
          ["Multiple Books", "Main novels, side stories, prequels, and spin-offs live in one canon."],
          ["Timeline Branches", "Alternate realities and resets can diverge without breaking continuity."],
          ["Persistent Characters", "Adrian, Evelyn, Julian, and Society factions survive across projects."],
          ["Narrative Brain", "Secrets, trauma, promises, betrayals, and payoffs feed every module."]
        ].map(([title, desc]) => `<div class="clue"><b>${title}</b><p class="muted">${desc}</p></div>`).join("")}
      </article>
      <article class="card">
        <h3>Future Franchise Titles</h3>
        ${["The 7th Death of Evelyn Cross", "Before Evelyn", "Blackthorn Origins", "Adrian Files", "Timeline Zero"].map(title => `<span class="pill">${title}</span>`).join(" ")}
      </article>
    </div>
  `;
}

function episodesTab(book) {
  const episodes = state.episodes || { items: [], total: 0 };
  const start = state.episodePage * state.episodePageSize + 1;
  const end = Math.min(episodes.total, start + episodes.items.length - 1);
  return `
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <div>
          <h3>Pocket FM Episode Engine</h3>
          <p class="muted">Episodes are created from chapters and can be scheduled, optimized, and published.</p>
        </div>
        <div class="button-row">
          <button class="btn" onclick="moveEpisodePage(-1)">Prev</button>
          <span class="pill">${episodes.total ? `${start}-${end} of ${episodes.total}` : "0 episodes"}</span>
          <button class="btn" onclick="moveEpisodePage(1)">Next</button>
          <button class="btn primary" onclick="scheduleEpisodes()">Schedule 30 Daily</button>
        </div>
      </div>
      <div class="episode-grid">
        ${episodes.items.map(ep => `
          <article class="episode-card">
            <div class="row" style="justify-content:space-between">
              <span class="pill">Ep ${ep.chapterNumber}</span>
              <span class="pill ${ep.releaseStatus === "scheduled" ? "good" : ""}">${ep.releaseStatus}</span>
            </div>
            <h4>${escapeHtml(ep.title)}</h4>
            <div class="mini-bars">
              <label>Suspense <span style="--value:${ep.suspenseScore}%"></span></label>
              <label>Binge <span style="--value:${ep.bingeProbability}%"></span></label>
              <label>Retention <span style="--value:${ep.retentionProbability}%"></span></label>
            </div>
          </article>
        `).join("") || `<div class="empty">Episodes appear as chapters are generated.</div>`}
      </div>
    </div>
  `;
}

async function moveEpisodePage(direction) {
  const total = state.episodes?.total || 0;
  const maxPage = Math.max(0, Math.ceil(total / state.episodePageSize) - 1);
  state.episodePage = Math.max(0, Math.min(maxPage, state.episodePage + direction));
  await loadEntertainmentSystems(state.activeBook.id);
  renderWorkspace();
}

async function scheduleEpisodes() {
  await api(`/api/books/${state.activeBook.id}/publishing/schedule`, {
    method: "POST",
    body: JSON.stringify({ count: 30, timezone: "Asia/Calcutta" })
  });
  toast("30 episodes scheduled");
  await loadEntertainmentSystems(state.activeBook.id);
  renderWorkspace();
}

function intelligenceTab(book) {
  const analytics = state.analytics;
  const graph = state.memoryGraph || { nodes: [], edges: [], recentClues: [] };
  const retention = state.retention;
  if (!analytics) return `<div class="panel empty">Intelligence systems come online after generation starts.</div>`;
  return `
    <div class="grid cards">
      <article class="card">
        <h3>AI Agent Council</h3>
        <div class="agent-list">
          ${analytics.agentScores.map(([name, score, focus]) => `
            <div class="agent-row">
              <div>
                <b>${escapeHtml(name)}</b>
                <div class="muted">${escapeHtml(focus)}</div>
              </div>
              <span class="pill good">${score}</span>
            </div>
          `).join("")}
        </div>
      </article>
      <article class="card">
        <h3>Memory Graph</h3>
        <div class="memory-graph">
          ${graph.edges.map(edge => `<div><b>${escapeHtml(edge.from)}</b> <span>${escapeHtml(edge.relation)}</span> <b>${escapeHtml(edge.to)}</b></div>`).join("") || `<p class="muted">No memory edges yet.</p>`}
        </div>
      </article>
      <article class="card">
        <h3>Recent Clue Trail</h3>
        ${graph.recentClues.map(clue => `
          <div class="clue">
            <span class="pill">Ch ${clue.chapterNumber}</span>
            <b>${escapeHtml(clue.title)}</b>
            <p class="muted">${escapeHtml(clue.clue)}</p>
          </div>
        `).join("") || `<p class="muted">Clues appear as chapters are written.</p>`}
      </article>
      <article class="card">
        <h3>Publishing Readiness</h3>
        <div class="readiness-ring" style="--score:${analytics.productionReadiness * 3.6}deg"><b>${analytics.productionReadiness}%</b></div>
        <p class="muted">${analytics.exportReadiness ? "Ready for clean export." : "Still generating or resolving warnings."}</p>
      </article>
      <article class="card">
        <h3>Retention Simulation</h3>
        <div class="row"><span class="pill good">Binge ${retention?.bingeScore || 0}</span><span class="pill">Completion ${retention?.completionForecast || 0}%</span><span class="pill warn">Risk ${retention?.dropoffRisk || "unknown"}</span></div>
        <div class="heatline">
          ${(retention?.points || []).slice(0, 36).map(p => `<span style="--heat:${p.emotionalHeat}%"></span>`).join("")}
        </div>
        ${(retention?.recommendations || []).map(r => `<p class="muted">${escapeHtml(r)}</p>`).join("")}
      </article>
    </div>
  `;
}

function governorTab(book) {
  const quality = state.quality;
  const recommendations = state.recommendations;
  if (!quality) return `<div class="panel empty">Quality governor activates after chapters exist.</div>`;
  return `
    <div class="grid cards">
      <article class="card">
        <h3>AI Quality Governor</h3>
        <div class="grid stats">
          <div class="stat"><span class="muted">AI Pattern Risk</span><b>${quality.aiPatternRisk}</b></div>
          <div class="stat"><span class="muted">Narrative Complexity</span><b>${quality.narrativeComplexity}</b></div>
          <div class="stat"><span class="muted">Dialogue Quality</span><b>${quality.dialogueQuality}</b></div>
          <div class="stat"><span class="muted">Continuity Health</span><b>${quality.continuityHealth}</b></div>
        </div>
        <button class="btn primary" onclick="runQualityGovernor()">Prepare Rewrite Plan</button>
      </article>
      <article class="card">
        <h3>Weak Chapter Detector</h3>
        ${(quality.weakChapters || []).map(item => `
          <div class="clue">
            <span class="pill warn">Ch ${item.chapterNumber}</span>
            <b>${escapeHtml(item.title)}</b>
            <p class="muted">${escapeHtml(item.issue)}</p>
            <p>${escapeHtml(item.action)}</p>
          </div>
        `).join("") || `<p class="muted">No weak chapters found yet.</p>`}
      </article>
      <article class="card">
        <h3>Recommendation Engine</h3>
        <p class="muted">Reader profiles and recommendation vectors are ready for future user behavior tracking.</p>
        <div class="row"><span class="pill good">Score ${recommendations?.vector?.recommendationScore || 0}</span></div>
        ${(recommendations?.vector?.nextBestActions || []).map(action => `<p>${escapeHtml(action)}</p>`).join("")}
      </article>
      <article class="card">
        <h3>Reader Profiles</h3>
        ${(recommendations?.readerProfiles || []).map(profile => `<div class="clue"><b>${escapeHtml(profile.name)}</b><p class="muted">${(profile.preferences || []).map(escapeHtml).join(" • ")}</p></div>`).join("")}
      </article>
    </div>
  `;
}

async function runQualityGovernor() {
  state.quality = await api(`/api/books/${state.activeBook.id}/quality-governor`, { method: "POST", body: "{}" });
  toast("Quality rewrite plan prepared");
  renderWorkspace();
}

function publishingTab(book) {
  const kdp = state.kdp || {};
  const distribution = state.distribution || { channels: [], jobs: [] };
  const monetization = state.monetization || { models: [] };
  return `
    <div class="grid cards">
      <article class="card">
        <span class="pill good">Amazon KDP Engine</span>
        <h3>${escapeHtml(kdp.title || book.title)}</h3>
        <p class="muted">${escapeHtml(kdp.bookDescription || "")}</p>
        <div class="row">${(kdp.keywords || []).slice(0, 7).map(keyword => `<span class="pill">${escapeHtml(keyword)}</span>`).join("")}</div>
        <div class="clue"><b>Validation</b><p class="muted">Pages: ${kdp.validation?.pageCount || 0} • ${escapeHtml(kdp.validation?.printMargins || "")}</p></div>
        <button class="btn" onclick="refreshKdp()">Refresh KDP Package</button>
      </article>
      <article class="card">
        <h3>Distribution Hub</h3>
        ${(distribution.jobs || []).map(job => `
          <div class="agent-row">
            <div><b>${escapeHtml(job.channel)}</b><div class="muted">${(job.workflow || []).join(" → ")}</div></div>
            <span class="pill">${job.status}</span>
          </div>
        `).join("")}
        <button class="btn" onclick="refreshDistribution()">Rebuild Distribution Plan</button>
      </article>
      <article class="card">
        <h3>Monetization Architecture</h3>
        ${(monetization.models || []).map(model => `
          <div class="trend-row">
            <div class="row" style="justify-content:space-between"><b>${escapeHtml(model.name)}</b><span class="pill">${model.readiness}%</span></div>
            <div class="progress"><span style="--value:${model.readiness}%"></span></div>
            <p class="muted">${escapeHtml(model.note)}</p>
          </div>
        `).join("")}
      </article>
      <article class="card">
        <h3>Enterprise Workers</h3>
        ${(state.workers || []).map(worker => `
          <div class="agent-row">
            <div><b>${escapeHtml(worker.name)}</b><div class="muted">${escapeHtml(worker.purpose)}</div></div>
            <span class="pill ${worker.status === "active" || worker.status === "busy" ? "good" : ""}">${worker.status}</span>
          </div>
        `).join("")}
      </article>
    </div>
  `;
}

async function refreshKdp() {
  state.kdp = await api(`/api/books/${state.activeBook.id}/kdp-package`, { method: "POST", body: "{}" });
  toast("KDP package refreshed");
  renderWorkspace();
}

async function refreshDistribution() {
  state.distribution = await api(`/api/books/${state.activeBook.id}/distribution-plan`, { method: "POST", body: "{}" });
  toast("Distribution plan rebuilt");
  renderWorkspace();
}

function devopsTab(book) {
  const devops = state.devops || {};
  const env = devops.env || { items: [], missing: [] };
  const readiness = devops.readinessScore || 0;
  return `
    <div class="grid cards">
      <article class="card">
        <span class="pill good">DevOps Control Plane</span>
        <h3>Global Deployment Readiness</h3>
        <div class="readiness-ring" style="--score:${readiness * 3.6}deg"><b>${readiness}%</b></div>
        <p class="muted">Environment: ${escapeHtml(env.currentEnvironment || "development")} • Missing keys: ${env.missing?.length || 0}</p>
        <div class="button-row">
          <button class="btn" onclick="refreshDevops()">Refresh Health</button>
          <button class="btn primary" onclick="createBackupNow()">Manual Backup</button>
        </div>
      </article>
      <article class="card">
        <h3>GitHub Integration</h3>
        ${providerStatus(devops.github)}
        <input class="input" id="github-repo" placeholder="owner/repository" value="${escapeHtml(devops.github?.repository || "owner/aria-storyverse")}">
        <div class="button-row">
          <button class="btn" onclick="connectGithub()">Connect Repository</button>
          <button class="btn" onclick="syncGithub()">Sync Storyverse</button>
          <button class="btn" onclick="createGithubRelease()">Tag Release</button>
          <button class="btn danger" onclick="disconnectGithub()">Disconnect</button>
        </div>
      </article>
      <article class="card">
        <h3>Vercel Deployments</h3>
        <p class="muted">Project: ${escapeHtml(devops.vercel?.projectName || "not linked")}</p>
        <div class="button-row">
          <button class="btn" onclick="connectVercel()">Link Project</button>
          <button class="btn primary" onclick="deployVercel('production')">Deploy Production</button>
          <button class="btn" onclick="deployVercel('preview')">Preview Deploy</button>
          <button class="btn danger" onclick="rollbackVercel()">Rollback</button>
        </div>
        ${(devops.deploymentJobs || []).slice(0, 3).map(job => `<div class="clue"><b>${escapeHtml(job.provider)} ${escapeHtml(job.target)}</b><p class="muted">${escapeHtml(job.status)} • ${escapeHtml(job.previewUrl || "")}</p></div>`).join("")}
      </article>
      <article class="card">
        <h3>Supabase Health</h3>
        <div class="row">
          <span class="pill ${devops.supabase?.urlConfigured ? "good" : "warn"}">URL ${devops.supabase?.urlConfigured ? "ok" : "missing"}</span>
          <span class="pill ${devops.supabase?.serviceKeyConfigured ? "good" : "warn"}">Service ${devops.supabase?.serviceKeyConfigured ? "ok" : "missing"}</span>
          <span class="pill">${escapeHtml(devops.supabase?.schemaStatus || "unknown")}</span>
        </div>
        <div class="button-row">
          <button class="btn" onclick="runSupabaseMigration()">Run Migration Check</button>
          <button class="btn" onclick="refreshDevops()">Verify Schema</button>
        </div>
      </article>
      <article class="card">
        <h3>Cloudflare</h3>
        <p class="muted">CDN: ${escapeHtml(devops.cloudflare?.cdnStatus || "not connected")} • Cache: ${escapeHtml(devops.cloudflare?.cacheStatus || "not connected")}</p>
        <div class="button-row">
          <button class="btn" onclick="connectCloudflare()">Prepare Pages/DNS</button>
          <button class="btn" onclick="purgeCloudflare()">Purge Cache</button>
        </div>
      </article>
      <article class="card">
        <h3>Environment Validation</h3>
        <div class="env-list">
          ${(env.items || []).map(item => `
            <div class="env-row">
              <div><b>${escapeHtml(item.key)}</b><span>${escapeHtml(item.system)}</span></div>
              <span class="pill ${item.configured ? "good" : "warn"}">${item.configured ? "set" : "missing"}</span>
            </div>
          `).join("")}
        </div>
      </article>
      <article class="card">
        <h3>Backup & Recovery</h3>
        ${(devops.backups || []).map(backup => `<div class="clue"><b>${escapeHtml(backup.type)} backup</b><p class="muted">${escapeHtml(backup.status)} • ${new Date(backup.createdAt).toLocaleString()}</p></div>`).join("") || `<p class="muted">No backups yet.</p>`}
      </article>
      <article class="card">
        <h3>Observability</h3>
        ${(devops.observability || []).slice(0, 8).map(event => `<div class="agent-row"><div><b>${escapeHtml(event.type)}</b><div class="muted">${escapeHtml(event.message)}</div></div><span class="pill ${event.severity === "warning" ? "warn" : "good"}">${event.severity}</span></div>`).join("") || `<p class="muted">No events yet.</p>`}
      </article>
    </div>
  `;
}

function providerStatus(provider) {
  if (!provider) return `<p class="muted">Not connected yet.</p>`;
  return `<div class="row"><span class="pill ${provider.connected ? "good" : "warn"}">${provider.connected ? "connected" : "disconnected"}</span><span class="pill ${provider.tokenConfigured ? "good" : "warn"}">token ${provider.tokenConfigured ? "set" : "missing"}</span><span class="pill">${escapeHtml(provider.health || "unknown")}</span></div>`;
}

async function refreshDevops() {
  state.devops = await api("/api/devops/status");
  toast("DevOps health refreshed");
  renderWorkspace();
}

async function connectGithub() {
  await api("/api/integrations/github/connect", {
    method: "POST",
    body: JSON.stringify({ repository: $("#github-repo")?.value || "owner/aria-storyverse" })
  });
  await refreshDevops();
}

async function syncGithub() {
  await api("/api/integrations/github/sync", {
    method: "POST",
    body: JSON.stringify({ repository: $("#github-repo")?.value || "owner/aria-storyverse", notes: "Backed up story universes and generated assets." })
  });
  await refreshDevops();
}

async function disconnectGithub() {
  await api("/api/integrations/github/disconnect", { method: "POST", body: "{}" });
  await refreshDevops();
}

async function createGithubRelease() {
  await api("/api/integrations/github/release", {
    method: "POST",
    body: JSON.stringify({ version: `v${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}` })
  });
  await refreshDevops();
}

async function connectVercel() {
  await api("/api/integrations/vercel/connect", { method: "POST", body: JSON.stringify({ projectName: "aria-storyverse" }) });
  await refreshDevops();
}

async function deployVercel(target) {
  await api("/api/integrations/vercel/deploy", { method: "POST", body: JSON.stringify({ target }) });
  await refreshDevops();
}

async function rollbackVercel() {
  await api("/api/integrations/vercel/rollback", { method: "POST", body: "{}" });
  await refreshDevops();
}

async function runSupabaseMigration() {
  await api("/api/integrations/supabase/migrate", { method: "POST", body: JSON.stringify({ name: "storyverse_devops_schema" }) });
  await refreshDevops();
}

async function connectCloudflare() {
  await api("/api/integrations/cloudflare/connect", { method: "POST", body: JSON.stringify({ projectName: "aria-storyverse-pages" }) });
  await refreshDevops();
}

async function purgeCloudflare() {
  await api("/api/integrations/cloudflare/purge-cache", { method: "POST", body: "{}" });
  await refreshDevops();
}

async function createBackupNow() {
  await api("/api/backups/create", { method: "POST", body: JSON.stringify({ type: "manual" }) });
  await refreshDevops();
}

function marketingTab(book) {
  return `
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <div>
          <h3>Viral Content Factory</h3>
          <p class="muted">Marketing assets are generated from the same universe, memory, and retention engine.</p>
        </div>
        <div class="button-row">
          <button class="btn" onclick="generateMarketing()">Regenerate Assets</button>
          <button class="btn" onclick="createAudioPackage()">Plan Audio Package</button>
          <button class="btn" onclick="createLocalization('Hindi')">Hindi Localization</button>
        </div>
      </div>
      <div class="grid cards" style="margin-top:16px">
        ${(state.marketing || []).map(asset => `
          <article class="card">
            <span class="pill">${escapeHtml(asset.channel)}</span>
            <h3>${escapeHtml(asset.type)}</h3>
            <p>${escapeHtml(asset.copy)}</p>
            <span class="pill good">Viral Score ${asset.score}</span>
          </article>
        `).join("") || `<div class="empty">Marketing assets will appear after generation starts.</div>`}
      </div>
    </div>
  `;
}

async function generateMarketing() {
  state.marketing = await api(`/api/books/${state.activeBook.id}/marketing`, { method: "POST", body: "{}" });
  toast("Marketing assets regenerated");
  renderWorkspace();
}

async function createAudioPackage() {
  await api(`/api/books/${state.activeBook.id}/audio-package`, { method: "POST", body: "{}" });
  toast("Audio production package planned");
}

async function createLocalization(language) {
  await api(`/api/books/${state.activeBook.id}/localize`, {
    method: "POST",
    body: JSON.stringify({ language })
  });
  toast(`${language} localization plan created`);
}

function coverTab(book) {
  const concepts = book.coverConcepts || [];
  return `
    <div class="grid cards">
      ${(concepts.length ? concepts : [{ gradientFrom: "#10131f", gradientTo: "#5e1629", accentColor: "#ff6b8a", genreLabel: "Dark Academia", emoji: "🕰️" }]).map((c, i) => `
        <div class="panel">
          <div class="book-cover" id="cover-${i}" style="background:linear-gradient(135deg,${c.gradientFrom},${c.gradientTo})">
            <div class="cover-kicker" style="color:${c.accentColor}">${escapeHtml(c.genreLabel)}</div>
            <div style="font-size:92px;text-align:center;margin-top:32%">${c.emoji}</div>
            <div class="cover-title">${escapeHtml(book.title)}</div>
            <div class="cover-author">${escapeHtml(book.authorName)}</div>
          </div>
          <p><button class="btn" onclick="downloadCover('${book.id}', ${i})">Download Cover JPG</button></p>
        </div>
      `).join("")}
    </div>
  `;
}

function previewTab(book) {
  const first = (book.chapters || [])[0];
  return `
    <div class="reader">
      <article class="reader-page">
        <h2>${escapeHtml(first ? first.title : book.title)}</h2>
        ${first ? first.content.split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join("") : `<p>Start generation to preview your book in a professional reading layout.</p>`}
      </article>
    </div>
  `;
}

function exportTab(book) {
  return `
    <div class="grid cards">
      ${[
        ["PDF", "Print-ready browser PDF via professional HTML print layout.", "pdf"],
        ["TXT", "Server-generated plain text manuscript for huge books.", "txt"],
        ["Markdown", "Server-generated formatted manuscript.", "md"],
        ["HTML", "Styled ebook layout with print CSS.", "html"],
        ["JSON", "Full structured archive for backups and migration.", "json"],
        ["Cover JPG", "High-quality generated cover image.", "cover"]
      ].map(([title, desc, type]) => `
        <article class="card">
          <h3>${title}</h3>
          <p class="muted">${desc}</p>
          <button class="btn primary" onclick="${type === "cover" ? `downloadCover('${book.id}', 0)` : `quickExport('${book.id}', '${type}')`}">Download ${title}</button>
        </article>
      `).join("")}
    </div>
  `;
}

async function quickExport(bookId, type) {
  if (type === "pdf") {
    window.open(`/api/books/${bookId}/export/html?inline=1`, "_blank");
    toast("Print-ready HTML opened. Use browser Print to save PDF.");
    return;
  }
  if (["txt", "md", "html", "json"].includes(type)) {
    window.location.href = `/api/books/${bookId}/export/${type}`;
    toast(`${type.toUpperCase()} export started`);
    return;
  }
  const book = await api(`/api/books/${bookId}`);
  const content = buildExport(book, type);
  const mime = type === "html" ? "text/html" : "text/plain";
  download(`${slug(book.title)}.${type}`, content, mime);
  toast(`${type.toUpperCase()} exported`);
}

function buildExport(book, type) {
  const chapters = book.chapters || [];
  if (type === "html") {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>body{font-family:Georgia,serif;background:#f6efdf;color:#17120c;line-height:1.75;max-width:760px;margin:60px auto;padding:0 28px}h1,h2{text-align:center}p{text-align:justify;text-indent:1.5em}</style></head><body><h1>${escapeHtml(book.title)}</h1><h2>${escapeHtml(book.subtitle || "")}</h2>${sectionHtml("Front Matter", book.frontMatter)}<h2>Table of Contents</h2><ol>${chapters.map(c => `<li>${escapeHtml(c.title)}</li>`).join("")}</ol>${chapters.map(c => sectionHtml(c.title, c.content)).join("")}${sectionHtml("Back Matter", book.backMatter)}</body></html>`;
  }
  if (type === "md") {
    return `# ${book.title}\n\n## ${book.subtitle || ""}\n\n## Front Matter\n\n${book.frontMatter || ""}\n\n## Table of Contents\n\n${chapters.map(c => `- Chapter ${c.chapterNumber}: ${c.title}`).join("\n")}\n\n${chapters.map(c => `## Chapter ${c.chapterNumber}: ${c.title}\n\n${c.content}`).join("\n\n")}\n\n## Back Matter\n\n${book.backMatter || ""}`;
  }
  return `${book.title}\n${book.subtitle || ""}\n${book.authorName || ""}\n\nFRONT MATTER\n\n${book.frontMatter || ""}\n\nTABLE OF CONTENTS\n\n${chapters.map(c => `${c.chapterNumber}. ${c.title}`).join("\n")}\n\n${chapters.map(c => `CHAPTER ${c.chapterNumber}: ${c.title}\n\n${c.content}`).join("\n\n")}\n\nBACK MATTER\n\n${book.backMatter || ""}`;
}

function sectionHtml(title, text) {
  return `<h2>${escapeHtml(title)}</h2>${String(text || "").split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join("")}`;
}

function exportPdf(book) {
  const html = buildExport(book, "html");
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 450);
  toast("PDF print dialog opened");
}

function downloadCover(bookId, index) {
  const book = state.activeBook || state.books.find(b => b.id === bookId);
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 2700;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#10131f");
  gradient.addColorStop(1, index === 1 ? "#5e1629" : "#382050");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 58px Georgia";
  ctx.fillText("DARK ACADEMIA", 150, 220);
  ctx.font = "220px Georgia";
  ctx.fillText("🕰️", 735, 1130);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 210px Georgia";
  wrapCanvasText(ctx, book?.title || "Evelyn Remembers", 150, 1880, 1500, 220);
  ctx.font = "64px Georgia";
  ctx.fillText(book?.authorName || "Tejaswi Roy", 150, 2470);
  canvas.toBlob(blob => downloadBlob(`${slug(book?.title || "cover")}-cover.jpg`, blob), "image/jpeg", 0.94);
  toast("Cover JPG exported");
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = `${word} `;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

function download(filename, content, mime) {
  downloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value) {
  return String(value || "aria-book").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function renderStickyJob() {
  const target = $("#sticky");
  if (!target) return;
  const job = state.jobs[0];
  if (!job) {
    target.innerHTML = "";
    return;
  }
  const pct = job.totalChapters ? Math.round((job.completedChapters / job.totalChapters) * 100) : 0;
  target.innerHTML = `
    <div class="sticky-job">
      <div class="row" style="justify-content:space-between">
        <b>⚡ ARIA is writing • ${escapeHtml(job.currentChapterTitle || job.phase)}</b>
        <span>${job.completedChapters}/${job.totalChapters} • ${pct}%</span>
      </div>
      <div class="button-row" style="margin-top:10px">
        <button class="btn" onclick="controlJob('${job.id}', 'pause')">Pause</button>
        <button class="btn" onclick="controlJob('${job.id}', 'resume')">Resume</button>
        <button class="btn danger" onclick="controlJob('${job.id}', 'cancel')">Cancel</button>
      </div>
      <div class="progress" style="margin-top:10px"><span style="--value:${pct}%"></span></div>
    </div>
  `;
}

function renderDebug() {
  const panel = $("#debug");
  if (!panel) return;
  const engineering = state.debug?.engineering;
  const validation = engineering?.validation;
  const health = engineering?.health;
  panel.className = `debug-panel ${state.debugOpen ? "open" : ""}`;
  panel.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <b>Engineering Dashboard</b>
      <button class="btn" onclick="state.debugOpen=false; renderDebug()">Close</button>
    </div>
    <p class="muted">Shortcut: CTRL + SHIFT + D</p>
    ${engineering ? `
      <div class="debug-grid">
        <div class="debug-card"><span>Build</span><b>${escapeHtml(validation?.buildStatus || "unknown")}</b></div>
        <div class="debug-card"><span>Deployment</span><b>${validation?.deploymentReady ? "ready" : "not ready"}</b></div>
        <div class="debug-card"><span>API</span><b>${escapeHtml(health?.api || "unknown")}</b></div>
        <div class="debug-card"><span>Database</span><b>${escapeHtml(health?.database || "unknown")}</b></div>
        <div class="debug-card"><span>Workers</span><b>${escapeHtml(health?.workers || "unknown")}</b></div>
        <div class="debug-card"><span>Queue</span><b>${escapeHtml(health?.queue || "unknown")}</b></div>
      </div>
      <h3>Active Issues</h3>
      ${(validation?.issuesFound || []).length ? validation.issuesFound.map(issue => `<div class="clue"><span class="pill warn">Issue</span><p>${escapeHtml(issue)}</p></div>`).join("") : `<p class="muted">No blocking issues in latest report.</p>`}
      <h3>Upgrade Proposals</h3>
      ${(engineering.proposals || []).slice(0, 5).map(item => `<div class="clue"><span class="pill">${escapeHtml(item.priority)}</span><b>${escapeHtml(item.title)}</b><p class="muted">${escapeHtml(item.reason)}</p></div>`).join("")}
    ` : ""}
    <details>
      <summary>Raw diagnostics</summary>
      <pre>${escapeHtml(JSON.stringify(state.debug || { loading: true }, null, 2))}</pre>
    </details>
  `;
}

function renderToast() {
  const box = $("#toast");
  if (!box) return;
  box.innerHTML = state.toast.map(t => `<div>${escapeHtml(t.message)}</div>`).join("");
}

render();
startPollers();
