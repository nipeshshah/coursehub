/* ============================================
   progress.js
   Tracks which videos a visitor has marked as
   completed, stored in the browser's localStorage
   (per-browser, per-device — there is no backend
   and no login, so this is purely local to the visitor).

   Storage shape:
   {
     "<course_id>": { "<video_id>": true, ... },
     ...
   }
   ============================================ */

const PROGRESS_STORAGE_KEY = "coursehub:progress:v1";

function loadProgressStore() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    // localStorage unavailable (private browsing, disabled, quota) — degrade silently
    return {};
  }
}

function saveProgressStore(store) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    // ignore write failures — progress just won't persist this session
  }
}

function isVideoCompleted(courseId, videoId) {
  const store = loadProgressStore();
  return !!(store[courseId] && store[courseId][videoId]);
}

function setVideoCompleted(courseId, videoId, completed) {
  const store = loadProgressStore();
  if (!store[courseId]) store[courseId] = {};

  if (completed) {
    store[courseId][videoId] = true;
  } else {
    delete store[courseId][videoId];
    if (Object.keys(store[courseId]).length === 0) delete store[courseId];
  }

  saveProgressStore(store);
}

function toggleVideoCompleted(courseId, videoId) {
  const nowCompleted = !isVideoCompleted(courseId, videoId);
  setVideoCompleted(courseId, videoId, nowCompleted);
  return nowCompleted;
}

/** Returns the set of completed video IDs for a course, limited to videos
 * that still actually exist in that course (guards against stale entries
 * left over after courses.csv is edited). */
function getCourseCompletedSet(course) {
  const store = loadProgressStore();
  const saved = store[course.id] || {};
  const validIds = new Set(course.videos.map((v) => v.id));
  return new Set(Object.keys(saved).filter((id) => validIds.has(id)));
}

function getCourseProgress(course) {
  const completed = getCourseCompletedSet(course);
  const total = course.videos.length;
  return {
    completed: completed.size,
    total,
    percent: total ? Math.round((completed.size / total) * 100) : 0,
    isComplete: total > 0 && completed.size === total,
  };
}

function getOverallStats(allCourses) {
  let videosWatched = 0;
  let totalVideos = 0;
  let coursesCompleted = 0;
  let coursesOngoing = 0;
  let coursesNotStarted = 0;

  allCourses.forEach((course) => {
    const { completed, total } = getCourseProgress(course);
    videosWatched += completed;
    totalVideos += total;

    if (total > 0 && completed === total) coursesCompleted++;
    else if (completed > 0) coursesOngoing++;
    else coursesNotStarted++;
  });

  const videosRemaining = totalVideos - videosWatched;

  return {
    videosWatched,
    videosRemaining,
    totalVideos,
    coursesCompleted,
    coursesOngoing,
    coursesNotStarted,
    coursesStarted: coursesCompleted + coursesOngoing,
    totalCourses: allCourses.length,
    percent: totalVideos ? Math.round((videosWatched / totalVideos) * 100) : 0,
  };
}

function clearAllProgress() {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch (err) {
    /* ignore */
  }
}

function clearCourseProgress(courseId) {
  const store = loadProgressStore();
  delete store[courseId];
  saveProgressStore(store);
}
