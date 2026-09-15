/* ============================================
   submit.js — course suggestion form
   ============================================ */

const $form = document.getElementById("submit-form");
const $formError = document.getElementById("form-error");
const $success = document.getElementById("submit-success");
const $downloadedFilename = document.getElementById("downloaded-filename");
const $submitAnotherBtn = document.getElementById("submit-another-btn");
const $categoryList = document.getElementById("existing-categories");
const $instructorList = document.getElementById("existing-instructors");

const $toggleLocalReview = document.getElementById("toggle-local-review");
const $localReviewPanel = document.getElementById("local-review-panel");
const $localReviewList = document.getElementById("local-review-list");
const $localCountBadge = document.getElementById("local-count-badge");
const $exportAllBtn = document.getElementById("export-all-btn");
const $clearLocalBtn = document.getElementById("clear-local-btn");

init();

async function init() {
  populateDatalists();
  renderLocalReviewList();

  $form.addEventListener("submit", handleSubmit);
  $submitAnotherBtn.addEventListener("click", resetForm);

  $toggleLocalReview.addEventListener("click", () => {
    $localReviewPanel.hidden = !$localReviewPanel.hidden;
  });

  $exportAllBtn.addEventListener("click", () => {
    const all = loadSubmissions();
    if (!all.length) return;
    downloadJson(`coursehub-submissions-${dateStamp()}.json`, all);
  });

  $clearLocalBtn.addEventListener("click", () => {
    if (!confirm("Clear the submission list saved in this browser? This does not affect any files you already downloaded or sent.")) return;
    clearSubmissions();
    renderLocalReviewList();
  });
}

async function populateDatalists() {
  try {
    const courses = await loadCourses();
    const categories = new Set(courses.map((c) => c.category).filter(Boolean));
    const instructors = new Set(courses.map((c) => c.instructor).filter(Boolean));
    $categoryList.innerHTML = Array.from(categories).map((c) => `<option value="${escapeAttr(c)}">`).join("");
    $instructorList.innerHTML = Array.from(instructors).map((c) => `<option value="${escapeAttr(c)}">`).join("");
  } catch (err) {
    // Datalists are a nicety — if the CSV can't be reached, the form still works fine without them.
  }
}

function handleSubmit(e) {
  e.preventDefault();
  $formError.textContent = "";

  const formData = new FormData($form);
  const course_title = (formData.get("course_title") || "").toString().trim();
  const playlist_url = (formData.get("playlist_url") || "").toString().trim();
  const description = (formData.get("description") || "").toString().trim();
  const category = (formData.get("category") || "").toString().trim();
  const level = (formData.get("level") || "").toString().trim();
  const tags = (formData.get("tags") || "")
    .toString()
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  const instructor = (formData.get("instructor") || "").toString().trim();
  const submitter_contact = (formData.get("submitter_contact") || "").toString().trim();
  const notes = (formData.get("notes") || "").toString().trim();

  if (!course_title || !playlist_url || !description || !category) {
    $formError.textContent = "Please fill in the required fields (marked with *).";
    return;
  }

  if (!isLikelyYouTubeUrl(playlist_url)) {
    $formError.textContent = "That doesn't look like a YouTube URL — double-check the link.";
    return;
  }

  const entry = addSubmission({
    course_title,
    playlist_url,
    description,
    category,
    level,
    tags,
    instructor,
    submitter_contact,
    notes,
  });

  const filename = `submission-${slugify(course_title)}-${dateStamp()}.json`;
  downloadJson(filename, entry);

  $downloadedFilename.textContent = filename;
  $form.hidden = true;
  $success.hidden = false;
  renderLocalReviewList();
}

function resetForm() {
  $form.reset();
  $form.hidden = false;
  $success.hidden = true;
  $formError.textContent = "";
}

function renderLocalReviewList() {
  const list = loadSubmissions().slice().reverse(); // newest first
  $localCountBadge.textContent = list.length;

  if (!list.length) {
    $localReviewList.innerHTML = `<p class="font-body-sm text-body-sm text-outline">No submissions from this browser yet.</p>`;
    return;
  }

  $localReviewList.innerHTML = list
    .map(
      (s) => `
    <div class="flex items-center justify-between gap-space-sm p-space-sm rounded-lg bg-surface-container-lowest" data-id="${escapeAttr(s.id)}">
      <div class="min-w-0">
        <div class="font-title-sm text-title-sm text-primary truncate">${escapeHtml(s.course_title)}</div>
        <div class="font-body-sm text-body-sm text-outline truncate">${escapeHtml(s.category || "")}${s.level ? " · " + escapeHtml(s.level) : ""} · ${new Date(s.submitted_at).toLocaleString()}</div>
      </div>
      <div class="flex items-center gap-space-xs shrink-0">
        <button type="button" class="redownload-btn font-label-sm text-label-sm text-secondary hover:underline" title="Download again">Download</button>
        <button type="button" class="delete-sub-btn font-label-sm text-label-sm text-error hover:underline" title="Remove from this list">Remove</button>
      </div>
    </div>`
    )
    .join("");

  $localReviewList.querySelectorAll(".redownload-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-id]").dataset.id;
      const entry = loadSubmissions().find((s) => s.id === id);
      if (entry) downloadJson(`submission-${slugify(entry.course_title)}-${dateStamp()}.json`, entry);
    });
  });

  $localReviewList.querySelectorAll(".delete-sub-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-id]").dataset.id;
      deleteSubmission(id);
      renderLocalReviewList();
    });
  });
}

function isLikelyYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === "youtu.be";
  } catch (err) {
    return false;
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}
