/* ============================================
   app.js — course catalog page (template-styled)
   ============================================ */

let ALL_COURSES = [];
let state = {
  q: "",
  sort: "featured",
  category: new Set(),
  level: new Set(),
  tags: new Set(),
  instructor: new Set(),
};

const $grid = document.getElementById("course-grid");
const $countHeading = document.getElementById("course-count-heading");
const $resultsCount = document.getElementById("results-count");
const $activeFilters = document.getElementById("active-filters");
const $search = document.getElementById("search-input");
const $sort = document.getElementById("sort-select");
const $filtersBody = document.getElementById("filters-body");
const $filtersToggle = document.getElementById("filters-toggle");
const $clearAll = document.getElementById("clear-all-btn");
const $facetList = document.getElementById("facet-list");
const $learningStats = document.getElementById("learning-stats");
const $learningSubline = document.getElementById("learning-subline");
const $learningBar = document.getElementById("learning-bar");
const $learningPercent = document.getElementById("learning-percent");
const $statVideosWatched = document.getElementById("stat-videos-watched");
const $statVideosRemaining = document.getElementById("stat-videos-remaining");
const $statCoursesOngoing = document.getElementById("stat-courses-ongoing");
const $statCoursesCompleted = document.getElementById("stat-courses-completed");
const $resetAllProgressBtn = document.getElementById("reset-all-progress-btn");

init();

async function init() {
  // Pre-fill search from ?q= if arriving from the course page's search box
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get("q");
  if (qParam) {
    state.q = qParam.trim().toLowerCase();
    $search.value = qParam;
  }

  try {
    ALL_COURSES = await loadCourses();
  } catch (err) {
    $grid.innerHTML = `<div class="col-span-full text-center py-space-xl text-error font-body-md text-body-md">Couldn't load course data. Make sure data/courses.csv exists. (${escapeHtml(err.message)})</div>`;
    return;
  }

  buildFacets();
  bindEvents();
  render();
  renderLearningStats();

  // Returning from a course page (incl. bfcache) should show fresh progress
  window.addEventListener("pageshow", () => {
    if (!ALL_COURSES.length) return;
    render();
    renderLearningStats();
  });
}

function renderLearningStats() {
  if (!$learningStats) return;
  const stats = getOverallStats(ALL_COURSES);

  // Stay hidden until the visitor has actually watched something
  if (stats.videosWatched === 0) {
    $learningStats.hidden = true;
    return;
  }

  $learningStats.hidden = false;
  $statCoursesCompleted.textContent = stats.coursesCompleted;
  $statCoursesOngoing.textContent = stats.coursesOngoing;
  $statVideosWatched.textContent = stats.videosWatched;
  $statVideosRemaining.textContent = stats.videosRemaining;

  $learningBar.style.width = `${stats.percent}%`;
  $learningPercent.textContent = `${stats.percent}%`;

  $learningSubline.textContent =
    stats.videosRemaining === 0
      ? `All ${stats.totalVideos} videos across ${stats.totalCourses} course${stats.totalCourses === 1 ? "" : "s"} complete.`
      : `${stats.videosWatched} of ${stats.totalVideos} videos watched across ${stats.totalCourses} course${stats.totalCourses === 1 ? "" : "s"}.`;
}

function bindEvents() {
  $search.addEventListener("input", (e) => {
    state.q = e.target.value.trim().toLowerCase();
    render();
  });

  $sort.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  $filtersToggle?.addEventListener("click", () => {
    $filtersBody.classList.toggle("hidden");
  });
  // start collapsed on mobile
  if (window.innerWidth < 1024) $filtersBody.classList.add("hidden");

  $clearAll.addEventListener("click", () => {
    state = { q: "", sort: state.sort, category: new Set(), level: new Set(), tags: new Set(), instructor: new Set() };
    $search.value = "";
    $facetList.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
    render();
  });

  $resetAllProgressBtn?.addEventListener("click", () => {
    if (!confirm("Reset your watched progress for every course? This only affects this browser.")) return;
    clearAllProgress();
    render();
    renderLearningStats();
  });

  // Collapsible facet groups (event delegation)
  $facetList.addEventListener("click", (e) => {
    const toggle = e.target.closest(".facet-toggle");
    if (!toggle) return;
    const body = toggle.parentElement.querySelector(".facet-options");
    const icon = toggle.querySelector(".facet-icon");
    body.classList.toggle("hidden");
    icon.classList.toggle("is-open");
  });
}

function buildFacets() {
  const facetDefs = [
    { key: "category", label: "Category", get: (c) => [c.category] },
    { key: "level", label: "Level", get: (c) => [c.level].filter(Boolean) },
    { key: "tags", label: "Topics", get: (c) => c.tags },
    { key: "instructor", label: "Creator", get: (c) => [c.instructor].filter(Boolean) },
  ];

  $facetList.innerHTML = "";

  facetDefs.forEach((def, i) => {
    const counts = new Map();
    ALL_COURSES.forEach((c) => {
      def.get(c).forEach((v) => {
        if (!v) return;
        counts.set(v, (counts.get(v) || 0) + 1);
      });
    });
    if (counts.size === 0) return;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    const group = document.createElement("div");
    group.className = "flex flex-col";
    group.innerHTML = `
      ${i > 0 ? '<div class="h-[1px] bg-surface-container-high w-full mb-space-lg"></div>' : ""}
      <button type="button" class="facet-toggle flex items-center justify-between py-space-xs group text-left cursor-pointer">
        <span class="font-title-sm text-title-sm text-primary font-semibold">${escapeHtml(def.label)}</span>
        <span class="material-symbols-outlined facet-icon is-open text-outline text-[18px]">expand_more</span>
      </button>
      <div class="facet-options flex flex-col gap-space-xs pt-space-sm max-h-[220px] overflow-y-auto">
        ${sorted
          .map(
            ([value, n]) => `
          <label class="flex items-center justify-between py-1 group cursor-pointer">
            <div class="flex items-center gap-space-sm min-w-0">
              <input type="checkbox" data-facet="${def.key}" value="${escapeAttr(value)}" class="w-4 h-4 rounded accent-secondary cursor-pointer shrink-0">
              <span class="font-body-md text-body-md text-on-surface group-hover:text-primary transition-colors truncate">${escapeHtml(value)}</span>
            </div>
            <span class="font-body-sm text-body-sm text-outline shrink-0 ml-2">${n}</span>
          </label>`
          )
          .join("")}
      </div>
    `;
    $facetList.appendChild(group);
  });

  $facetList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const key = e.target.dataset.facet;
      const val = e.target.value;
      if (e.target.checked) state[key].add(val);
      else state[key].delete(val);
      render();
    });
  });
}

function matchesFilters(course) {
  if (state.q) {
    const haystack = `${course.title} ${course.description} ${course.tags.join(" ")} ${course.instructor}`.toLowerCase();
    if (!haystack.includes(state.q)) return false;
  }
  if (state.category.size && !state.category.has(course.category)) return false;
  if (state.level.size && !state.level.has(course.level)) return false;
  if (state.instructor.size && !state.instructor.has(course.instructor)) return false;
  if (state.tags.size) {
    const hasTag = course.tags.some((t) => state.tags.has(t));
    if (!hasTag) return false;
  }
  return true;
}

function sortCourses(list) {
  const arr = [...list];
  if (state.sort === "title") {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  } else if (state.sort === "videos") {
    arr.sort((a, b) => b.videos.length - a.videos.length);
  }
  return arr;
}

function render() {
  $countHeading.textContent = ALL_COURSES.length;
  renderActiveChips();

  const filtered = sortCourses(ALL_COURSES.filter(matchesFilters));
  $resultsCount.textContent = `Showing ${filtered.length} of ${ALL_COURSES.length}`;

  if (!filtered.length) {
    $grid.innerHTML = `
      <div class="col-span-full text-center py-space-xl rounded-xl border border-dashed border-outline-variant">
        <p class="font-headline-md text-headline-md text-primary mb-1">No courses match those filters</p>
        <p class="font-body-md text-body-md text-on-surface-variant">Try clearing a filter or searching a different term.</p>
      </div>`;
    return;
  }

  $grid.innerHTML = filtered.map(courseCardHtml).join("");
}

function courseCardHtml(course) {
  const tagHtml = course.tags
    .slice(0, 3)
    .map((t) => `<span class="px-space-sm py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">${escapeHtml(t)}</span>`)
    .join("");

  const initials = (course.instructor || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const prog = getCourseProgress(course);
  const progressBadge = prog.isComplete
    ? `<div class="absolute top-space-sm left-space-sm bg-secondary text-on-secondary px-space-sm py-space-xs rounded-full font-label-sm text-label-sm flex items-center gap-1 shadow-sm">
         <span class="material-symbols-outlined text-[14px]">task_alt</span>
         <span>Completed</span>
       </div>`
    : prog.completed > 0
      ? `<div class="absolute top-space-sm left-space-sm bg-surface-container-lowest/90 text-primary px-space-sm py-space-xs rounded-full font-label-sm text-label-sm backdrop-blur-sm shadow-sm">
           ${prog.completed}/${prog.total} watched
         </div>`
      : "";

  const progressBar =
    prog.completed > 0
      ? `<div class="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
           <div class="h-full bg-secondary rounded-full transition-all" style="width:${prog.percent}%"></div>
         </div>`
      : "";

  return `
    <a href="course.html?id=${encodeURIComponent(course.id)}" class="group flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
      <div class="relative aspect-video w-full bg-surface-container-highest overflow-hidden">
        <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${escapeAttr(course.thumbnail)}" alt="" loading="lazy">
        <div class="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent"></div>
        <div class="absolute top-space-sm right-space-sm bg-primary/85 text-surface-bright px-space-sm py-space-xs rounded-full font-label-sm text-label-sm backdrop-blur-sm flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">playlist_play</span>
          <span>${course.videos.length} video${course.videos.length === 1 ? "" : "s"}</span>
        </div>
        ${progressBadge}
        ${
          course.level
            ? `<div class="absolute bottom-space-sm left-space-sm">
                <span class="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-md bg-secondary text-surface-bright font-label-sm text-label-sm font-bold tracking-wide uppercase">${escapeHtml(course.level)}</span>
              </div>`
            : ""
        }
      </div>
      <div class="flex flex-col flex-1 p-space-md justify-between gap-space-md">
        <div>
          <span class="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">${escapeHtml(course.category)}</span>
          <h3 class="font-headline-md text-headline-md text-primary mt-1 group-hover:text-secondary transition-colors leading-tight">${escapeHtml(course.title)}</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mt-space-sm line-clamp-2">${escapeHtml(course.description)}</p>
        </div>
        <div class="flex flex-col gap-space-md">
          ${progressBar}
          <div class="flex flex-wrap gap-space-xs items-center">${tagHtml}</div>
          <div class="flex items-center justify-between pt-space-xs">
            <div class="flex items-center gap-space-xs min-w-0">
              <div class="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold text-[10px] shrink-0">${escapeHtml(initials)}</div>
              <span class="font-body-sm text-body-sm text-outline font-medium truncate">${escapeHtml(course.instructor || "")}</span>
            </div>
            <span class="px-space-md py-2 bg-primary group-hover:bg-primary-container text-on-primary rounded-lg font-title-sm text-title-sm flex items-center gap-1 transition-colors shrink-0">
              <span>Watch</span>
              <span class="material-symbols-outlined text-[16px]">play_arrow</span>
            </span>
          </div>
        </div>
      </div>
    </a>
  `;
}

function renderActiveChips() {
  const chips = [];
  ["category", "level", "tags", "instructor"].forEach((key) => {
    state[key].forEach((val) => chips.push({ key, val }));
  });

  if (!chips.length) {
    $activeFilters.innerHTML = `<span class="font-body-sm text-body-sm text-on-surface-variant">None — showing all courses</span>`;
    return;
  }

  $activeFilters.innerHTML = chips
    .map(
      (c) => `
      <span class="inline-flex items-center gap-1 px-space-sm py-1 bg-secondary-container text-on-secondary-container rounded-full text-label-sm font-label-sm" data-key="${c.key}" data-val="${escapeAttr(c.val)}">
        <span>${escapeHtml(c.val)}</span>
        <button type="button" class="hover:text-primary cursor-pointer" aria-label="Remove filter ${escapeAttr(c.val)}">
          <span class="material-symbols-outlined text-[14px]">close</span>
        </button>
      </span>`
    )
    .join("");

  $activeFilters.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-key]");
      const { key, val } = chip.dataset;
      state[key].delete(val);
      const cb = $facetList.querySelector(`input[data-facet="${key}"][value="${cssEscape(val)}"]`);
      if (cb) cb.checked = false;
      render();
    });
  });
}

function cssEscape(v) {
  return window.CSS && CSS.escape ? CSS.escape(v) : v.replace(/"/g, '\\"');
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
