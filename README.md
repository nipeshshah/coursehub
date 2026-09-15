# CourseHub

A static site that turns a spreadsheet of YouTube videos into a browsable course
catalog — faceted filters, search, and an in-page video player. No backend,
no build step: it's ready for GitHub Pages as-is.

## How it works

Everything is driven by one file: `data/courses.csv`. The site fetches that
file in the browser (using [PapaParse](https://www.papaparse.com/)) and
groups rows into courses. There's no server and no database — updating the
site means replacing that CSV and pushing.

## Updating the course data

Open `data/courses.csv` in Excel, Google Sheets, or a text editor. Each row
is **one video**. Videos with the same `course_id` are grouped into the same
course, in the order given by `video_order`.

| Column              | Required | Notes                                                              |
|---------------------|----------|---------------------------------------------------------------------|
| `course_id`         | yes      | Short unique code, e.g. `py101`. Same value groups videos together. |
| `course_title`      | yes      | Repeat the same title on every row for that course.                 |
| `course_description`| yes      | One or two sentences.                                               |
| `category`          | yes      | One category per course, e.g. `Programming`, `Design`.              |
| `tags`              | no       | Semicolon-separated, e.g. `python;beginner;api`.                    |
| `instructor`        | no       | Creator / channel name.                                             |
| `level`             | no       | e.g. `Beginner`, `Intermediate`, `Advanced`.                         |
| `course_thumbnail`  | no       | Image URL. Leave blank to auto-use the first video's YouTube thumbnail. |
| `video_id`          | yes      | The YouTube video ID (the part after `v=` in a YouTube URL).         |
| `video_title`       | yes      | Title of that individual video.                                     |
| `video_order`       | yes      | Integer — position of the video within the course (1, 2, 3…).       |
| `video_duration`    | no       | Free text, e.g. `12:45`.                                             |

If you're exporting from Excel, save/export as **CSV (Comma delimited)**
and overwrite `data/courses.csv`.

Working with a spreadsheet full of playlists? Ask Claude to convert your raw
YouTube export (titles + video IDs) into rows matching this schema — that's
usually the fastest path from "list of YouTube links" to a working site.

## Running locally

Because the page fetches a local file over `fetch()`, opening `index.html`
directly (`file://`) won't work in most browsers. Serve the folder instead:

```bash
# from inside the course-site folder
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying to GitHub Pages

1. Create a new GitHub repository and push this entire folder to it (the
   contents of `course-site/`, not a subfolder containing it).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   pick the `main` branch and `/ (root)` folder, then **Save**.
4. GitHub will give you a URL like `https://yourname.github.io/repo-name/`.
   It can take a minute or two to go live.
5. To publish new courses later: edit `data/courses.csv`, commit, and push.
   No rebuild step needed — the site reads the CSV live.

## Progress tracking

Visitors can mark videos as watched, and the site keeps per-course and
overall statistics.

- **On a course page**: a "Mark as watched" button under the player, green
  checkmarks in the playlist, a progress bar, a "Your Progress" stat, and a
  "Reset progress" link for that course.
- **On the catalog page**: a "Your Learning" panel directly under the
  "Structured Courses" heading, showing an overall completion bar plus four
  figures — courses completed, courses ongoing, videos completed, and videos
  remaining. Course cards also get progress bars and a "Completed" badge.
  The panel stays hidden until the visitor has watched something, so a
  first-time visitor doesn't see a row of zeros.

  Note that "ongoing" counts only courses that are started but unfinished, so
  completed / ongoing / not-started never double-count the same course, and
  videos completed + videos remaining always equals the library total.

### Important: how this is stored

Progress is saved in the browser's `localStorage` under the key
`coursehub:progress:v1`. That means:

- It's **per browser and per device**. The same person on their phone and
  laptop will see two separate sets of progress.
- There are no user accounts, so progress is **not** tied to an identity.
- Clearing browser data, or using private/incognito mode, wipes it.

This is a deliberate trade-off: real cross-device accounts would need a
backend with logins and a database, which GitHub Pages can't host. If you
later want synced accounts, you'd need a service like Firebase, Supabase, or
Auth0 alongside the site.

Editing `data/courses.csv` is safe — progress entries for videos that no
longer exist are ignored rather than counted, so the stats stay accurate.

## Course submissions ("Found a course? Submit it")

There's a `submit.html` page (linked from the nav and from the catalog's
"Expand the Library" panel) where anyone can suggest a course.

**How it actually works, given there's no backend:** the form can't write
into your repo directly — no static site can. When someone submits the
form, their browser:

1. Saves the submission to that visitor's own `localStorage` (a personal
   record, not a shared inbox — see the "Progress tracking" note above for
   why this is per-browser).
2. Immediately downloads a JSON file, e.g. `submission-sql-basics-2026-09-15.json`.

The submitter then needs to get that file to you — email, a GitHub issue,
Slack, however you prefer. There's no way around this step on a static,
serverless site.

### Reviewing submissions you've received

1. Drop the `.json` files people send you into the `submissions/` folder.
2. Run:
   ```bash
   python3 scripts/submissions_to_csv.py
   ```
   This reads every file in `submissions/` and writes draft rows to
   `pending_courses.csv`, printing a summary (title, playlist link,
   submitter, notes) for each one so you can sanity-check them.
3. **You still need to manually visit each submitted playlist** and fill in
   the actual video IDs, titles, and durations — a submission only tells you
   about the course as a whole, not its individual videos. Each draft row is
   a placeholder for one video; duplicate the row per video in the playlist.
4. Once a course's rows look right, move them into `data/courses.csv`.

The submission form also has a small "Submissions saved in this browser"
panel at the bottom, useful if you're testing the form yourself or want to
re-download something you already sent.

## Advertising space

There are two placeholder ad slots already wired into the layout:
- A slot in the sidebar of the course catalog and course pages.
- An inline slot dropped into the grid after the 6th course card.

Drop your ad network's embed code into the elements with class `ad-slot` in
`index.html` / `course.html`, or replace them with a script tag from your
ad provider.

## File structure

```
course-site/
├── index.html            Course catalog (search + facets + learning stats)
├── course.html           Course detail + video player
├── submit.html           "Suggest a course" form
├── js/
│   ├── data.js             Loads & parses the CSV
│   ├── progress.js         Watched-video tracking (localStorage)
│   ├── submissions.js      Course-submission storage + JSON export
│   ├── app.js              Catalog page logic
│   ├── course.js           Player page logic
│   └── submit.js           Submission form logic
├── data/courses.csv      <- edit this to update the site
├── submissions/          <- drop reviewed submission .json files here
├── scripts/
│   └── submissions_to_csv.py   Converts submissions/ into draft CSV rows
└── README.md
```

## Customizing

- **Colors and fonts** live in the `tailwind.config` block near the top of
  `index.html` and `course.html`. If you change a color there, change it in
  both files so the two pages stay in sync.
- **Site name / tagline** are plain text in the `<header>` of both HTML files.
- Want an "Excel upload" admin page instead of editing CSV by hand, or
  support for `.xlsx` files directly (via SheetJS)? Ask Claude to add it —
  the current CSV-only approach was chosen because it needs zero extra
  tooling to deploy on GitHub Pages.
