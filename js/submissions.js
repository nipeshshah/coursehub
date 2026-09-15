/* ============================================
   submissions.js
   Handles the "suggest a course" form.

   IMPORTANT — how this actually works on a static site:
   There is no backend, so a visitor's browser cannot write
   into this repo's files. Submissions are kept in the
   *submitter's own* localStorage as a personal record, and
   each submission triggers a JSON file download. The
   submitter sends you that file (email, GitHub issue,
   Slack — whatever works for you), and you review it before
   adding it to data/courses.csv. See scripts/submissions_to_csv.py
   for a helper that turns a folder of these JSON files into
   CSV rows.
   ============================================ */

const SUBMISSIONS_STORAGE_KEY = "coursehub:submissions:v1";

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveSubmissions(list) {
  try {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    /* ignore write failures */
  }
}

function addSubmission(data) {
  const entry = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    submitted_at: new Date().toISOString(),
    ...data,
  };
  const list = loadSubmissions();
  list.push(entry);
  saveSubmissions(list);
  return entry;
}

function deleteSubmission(id) {
  const list = loadSubmissions().filter((s) => s.id !== id);
  saveSubmissions(list);
}

function clearSubmissions() {
  saveSubmissions([]);
}

function slugify(str) {
  return String(str || "course")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "course";
}

/** Triggers a browser download of `data` as a pretty-printed JSON file. */
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
