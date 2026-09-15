/* ============================================
   data.js
   Loads data/courses.csv (via PapaParse) and reshapes
   the flat, one-row-per-video CSV into an array of
   course objects, each with a `videos` array.

   CSV columns expected:
   course_id, course_title, course_description, category,
   tags (semicolon-separated), instructor, level,
   course_thumbnail (optional), video_id (YouTube ID),
   video_title, video_order, video_duration
   ============================================ */

const DATA_URL = "data/courses.csv";

function splitTags(raw) {
  if (!raw) return [];
  return raw
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

function youtubeThumb(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Fetches and parses the CSV, returning a Promise that resolves
 * to an array of course objects:
 * { id, title, description, category, tags[], instructor, level,
 *   thumbnail, videos: [{ id, title, order, duration }] }
 */
function loadCourses() {
  return new Promise((resolve, reject) => {
    Papa.parse(DATA_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          resolve(rowsToCourses(results.data));
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}

function rowsToCourses(rows) {
  const byId = new Map();

  rows.forEach((row) => {
    const id = (row.course_id || "").trim();
    if (!id) return;

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        title: (row.course_title || "Untitled course").trim(),
        description: (row.course_description || "").trim(),
        category: (row.category || "Uncategorized").trim(),
        tags: splitTags(row.tags),
        instructor: (row.instructor || "").trim(),
        level: (row.level || "").trim(),
        thumbnail: (row.course_thumbnail || "").trim(),
        videos: [],
      });
    }

    const course = byId.get(id);
    const videoId = (row.video_id || "").trim();
    if (videoId) {
      course.videos.push({
        id: videoId,
        title: (row.video_title || "Untitled video").trim(),
        order: parseInt(row.video_order, 10) || course.videos.length + 1,
        duration: (row.video_duration || "").trim(),
      });
    }
  });

  const courses = Array.from(byId.values());

  courses.forEach((course) => {
    course.videos.sort((a, b) => a.order - b.order);
    if (!course.thumbnail && course.videos.length) {
      course.thumbnail = youtubeThumb(course.videos[0].id);
    }
  });

  return courses;
}

function getCourseById(courses, id) {
  return courses.find((c) => c.id === id);
}
