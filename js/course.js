/* ============================================
   course.js — single course / video player page
   ============================================ */

const $breadcrumbTitle = document.getElementById("breadcrumb-title");
const $playerWrap = document.getElementById("player-wrap");
const $nowIndex = document.getElementById("now-index");
const $nowVideoId = document.getElementById("now-video-id");
const $nowTitle = document.getElementById("now-title");
const $watchLink = document.getElementById("watch-on-youtube");
const $playlist = document.getElementById("playlist-list");
const $playlistCount = document.getElementById("playlist-count");
const $playlistProgress = document.getElementById("playlist-progress");
const $shuffleBtn = document.getElementById("shuffle-btn");
const $courseTitle = document.getElementById("course-title");
const $courseInstructorChip = document.getElementById("course-instructor-chip");
const $courseDesc = document.getElementById("course-desc");
const $courseTags = document.getElementById("course-tags");
const $statRuntime = document.getElementById("stat-runtime");
const $statLevel = document.getElementById("stat-level");
const $statCategory = document.getElementById("stat-category");
const $statProgress = document.getElementById("stat-progress");
const $bookmarkBtn = document.getElementById("bookmarkBtn");
const $bmIcon = document.getElementById("bmIcon");
const $bmText = document.getElementById("bmText");
const $searchInput = document.getElementById("search-input");
const $markCompleteBtn = document.getElementById("mark-complete-btn");
const $markCompleteIcon = document.getElementById("mark-complete-icon");
const $markCompleteText = document.getElementById("mark-complete-text");
const $resetProgressBtn = document.getElementById("reset-progress-btn");

let CURRENT_COURSE = null;
let CURRENT_INDEX = 0;

init();

async function init() {
  bindHeaderSearch();
  bindBookmark();

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");

  let courses;
  try {
    courses = await loadCourses();
  } catch (err) {
    showError("Couldn't load course data.");
    return;
  }

  const course = getCourseById(courses, courseId);
  if (!course || !course.videos.length) {
    showError("Course not found. It may have been removed or the link is incorrect.");
    return;
  }

  CURRENT_COURSE = course;
  renderCourse(course);

  let activeIndex = 0;
  const videoParam = params.get("v");
  if (videoParam) {
    const idx = course.videos.findIndex((v) => v.id === videoParam);
    if (idx >= 0) activeIndex = idx;
  }

  playVideo(course, activeIndex);

  $shuffleBtn?.addEventListener("click", () => {
    if (course.videos.length < 2) return;
    let idx;
    do {
      idx = Math.floor(Math.random() * course.videos.length);
    } while (course.videos.length > 1 && course.videos[idx].id === getCurrentVideoId());
    playVideo(course, idx);
  });

  $markCompleteBtn?.addEventListener("click", () => {
    const video = course.videos[CURRENT_INDEX];
    if (!video) return;
    const nowCompleted = toggleVideoCompleted(course.id, video.id);
    updateMarkCompleteButton(nowCompleted);
    updatePlaylistCompletionMarks(course);
    updateProgressStats(course);
  });

  $resetProgressBtn?.addEventListener("click", () => {
    if (!confirm("Reset your watched progress for this course? This only affects this browser.")) return;
    clearCourseProgress(course.id);
    updateMarkCompleteButton(isVideoCompleted(course.id, course.videos[CURRENT_INDEX].id));
    updatePlaylistCompletionMarks(course);
    updateProgressStats(course);
  });
}

function bindHeaderSearch() {
  $searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.trim();
      window.location.href = `index.html${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    }
  });
}

function bindBookmark() {
  let isBookmarked = false;
  $bookmarkBtn?.addEventListener("click", () => {
    isBookmarked = !isBookmarked;
    if (isBookmarked) {
      $bmIcon.textContent = "bookmark";
      $bmIcon.style.fontVariationSettings = "'FILL' 1";
      $bmText.textContent = "Saved";
      $bookmarkBtn.classList.add("text-secondary");
    } else {
      $bmIcon.textContent = "bookmark_border";
      $bmIcon.style.fontVariationSettings = "'FILL' 0";
      $bmText.textContent = "Save Course";
      $bookmarkBtn.classList.remove("text-secondary");
    }
  });
}

function getCurrentVideoId() {
  return new URLSearchParams(window.location.search).get("v");
}

function renderCourse(course) {
  document.title = `${course.title} — CourseHub`;
  $breadcrumbTitle.textContent = course.title;
  $courseTitle.textContent = course.title;
  $courseDesc.textContent = course.description;
  $playlistCount.textContent = `${course.videos.length} video${course.videos.length === 1 ? "" : "s"}`;

  const initials = (course.instructor || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  $courseInstructorChip.innerHTML = course.instructor
    ? `<div class="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-on-secondary font-bold text-[11px]">${escapeHtml(initials)}</div>
       <span class="font-label-md text-label-md text-on-surface-variant">By <span class="text-primary font-semibold">${escapeHtml(course.instructor)}</span></span>`
    : "";

  $courseTags.innerHTML = course.tags
    .map((t) => `<span class="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md">${escapeHtml(t)}</span>`)
    .join("");

  $statLevel.textContent = course.level || "All levels";
  $statCategory.textContent = course.category || "—";
  $statRuntime.textContent = formatDuration(sumDurations(course.videos)) || "—";

  const completedSet = getCourseCompletedSet(course);

  $playlist.innerHTML = course.videos
    .map(
      (v, i) => `
      <button type="button" class="playlist-item group relative flex items-start gap-3 p-3.5 w-full text-left hover:bg-surface-container-low transition-colors cursor-pointer bg-surface-container-lowest" data-index="${i}">
        <div class="playlist-num w-6 h-6 rounded-md bg-surface-container-high text-on-surface-variant font-mono text-[12px] font-medium flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-on-primary transition-colors">${i + 1}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <span class="playlist-title font-title-sm text-title-sm text-on-surface group-hover:text-primary font-medium truncate">${escapeHtml(v.title)}</span>
            ${v.duration ? `<span class="font-mono text-body-sm text-body-sm text-outline shrink-0">${escapeHtml(v.duration)}</span>` : ""}
          </div>
          <div class="flex items-center justify-between gap-1 mt-0.5">
            <span class="font-mono text-body-sm text-body-sm text-outline truncate">${escapeHtml(v.id)}</span>
            <span class="flex items-center gap-1.5 shrink-0">
              <span class="playlist-done-icon material-symbols-outlined text-[16px] text-secondary ${completedSet.has(v.id) ? "" : "hidden"}" title="Watched">check_circle</span>
              <span class="playlist-state-icon text-outline-variant group-hover:text-secondary flex items-center transition-colors">
                <span class="material-symbols-outlined text-[18px]">play_circle</span>
              </span>
            </span>
          </div>
        </div>
      </button>`
    )
    .join("");

  $playlist.querySelectorAll(".playlist-item").forEach((btn) => {
    btn.addEventListener("click", () => playVideo(course, parseInt(btn.dataset.index, 10)));
  });

  updateProgressStats(course);
}

function playVideo(course, index) {
  const video = course.videos[index];
  if (!video) return;

  CURRENT_INDEX = index;

  $playerWrap.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${encodeURIComponent(video.id)}?rel=0"
      title="${escapeAttr(video.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>`;

  $nowIndex.textContent = `Video ${index + 1} of ${course.videos.length}`;
  $nowVideoId.textContent = `ID: ${video.id}`;
  $nowTitle.textContent = video.title;
  $watchLink.href = `https://youtu.be/${video.id}`;

  $playlist.querySelectorAll(".playlist-item").forEach((btn, i) => {
    const isActive = i === index;
    btn.classList.toggle("bg-secondary-container/40", isActive);
    const num = btn.querySelector(".playlist-num");
    const title = btn.querySelector(".playlist-title");
    const stateIcon = btn.querySelector(".playlist-state-icon");
    if (isActive) {
      num.classList.add("bg-secondary", "text-on-secondary");
      num.classList.remove("bg-surface-container-high", "text-on-surface-variant");
      title.classList.add("text-primary", "font-bold");
      title.classList.remove("text-on-surface", "font-medium");
      stateIcon.innerHTML = `<span class="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary font-bold"><span class="material-symbols-outlined text-[14px] animate-pulse">volume_up</span>Playing</span>`;
    } else {
      num.classList.remove("bg-secondary", "text-on-secondary");
      num.classList.add("bg-surface-container-high", "text-on-surface-variant");
      title.classList.remove("text-primary", "font-bold");
      title.classList.add("text-on-surface", "font-medium");
      stateIcon.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_circle</span>`;
    }
  });

  const activeEl = $playlist.querySelector(".playlist-item.bg-secondary-container\\/40");
  activeEl?.scrollIntoView({ block: "nearest" });

  updateMarkCompleteButton(isVideoCompleted(course.id, video.id));

  const url = new URL(window.location);
  url.searchParams.set("v", video.id);
  window.history.replaceState({}, "", url);
}

function updateMarkCompleteButton(isCompleted) {
  if (!$markCompleteBtn) return;
  if (isCompleted) {
    $markCompleteIcon.textContent = "check_circle";
    $markCompleteIcon.style.fontVariationSettings = "'FILL' 1";
    $markCompleteText.textContent = "Watched";
    $markCompleteBtn.classList.add("bg-secondary-container", "text-on-secondary-container");
    $markCompleteBtn.classList.remove("bg-surface-container", "text-on-surface-variant");
  } else {
    $markCompleteIcon.textContent = "radio_button_unchecked";
    $markCompleteIcon.style.fontVariationSettings = "'FILL' 0";
    $markCompleteText.textContent = "Mark as watched";
    $markCompleteBtn.classList.remove("bg-secondary-container", "text-on-secondary-container");
    $markCompleteBtn.classList.add("bg-surface-container", "text-on-surface-variant");
  }
}

function updatePlaylistCompletionMarks(course) {
  const completedSet = getCourseCompletedSet(course);
  $playlist.querySelectorAll(".playlist-item").forEach((btn, i) => {
    const doneIcon = btn.querySelector(".playlist-done-icon");
    if (!doneIcon) return;
    doneIcon.classList.toggle("hidden", !completedSet.has(course.videos[i].id));
  });
}

function updateProgressStats(course) {
  const { completed, total, percent } = getCourseProgress(course);
  if ($statProgress) $statProgress.textContent = `${completed} of ${total} watched`;
  if ($playlistProgress) $playlistProgress.style.width = `${percent}%`;
}

function sumDurations(videos) {
  let total = 0;
  let any = false;
  videos.forEach((v) => {
    const s = parseDuration(v.duration);
    if (s != null) {
      total += s;
      any = true;
    }
  });
  return any ? total : null;
}

function parseDuration(str) {
  if (!str) return null;
  const parts = str.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  let seconds = 0;
  if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
  else if (parts.length === 1) seconds = parts[0];
  else return null;
  return seconds;
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function showError(message) {
  const container = document.querySelector("main .max-w-7xl.pb-space-xl") || document.querySelector("main");
  container.innerHTML = `<div class="max-w-7xl mx-auto px-margin-desktop py-space-xl text-center font-body-md text-body-md text-error">${escapeHtml(message)}</div>`;
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
