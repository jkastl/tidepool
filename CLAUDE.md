# tidepool

Small, odd things washed up for a look. Each folder here is one build: an
explainer, a tool, a lab, a toy, a proposal, whatever form fits the idea
behind it. Builds come from scheduled idea-tank runs (and later from the
manatee idea generator). The site is served at
`https://jkastl.github.io/tidepool/`.

**Everything in this repo is public.** A build is about its topic, never
about the person whose idea it was: no quoted captures, no names, places, or
personal details. The private checks (a term list and a scanner) live in the
private idea-tank repo, and idea-tank runs apply them before every push. A
session working in this repo alone cannot run them, so it must not add
anything that came from a private capture.

The same goes for everything else here, not just builds: this file, the
front page, commit messages, and pull request titles and descriptions. Refer
to the person who owns the repo as "the owner", never by name.

## Branching: builds go straight to main, setup goes through a PR

Pages serves `main`, so a push to `main` is a publish.

| Change | How |
| --- | --- |
| A build: a new `<slug>/` folder, its `builds.json` entry, and its line in `sitemap.xml` | Commit straight to `main` and push. No pull request. |
| A revision or a tweak: changes to the files inside an existing `<slug>/` folder, its `builds.json` entry, and `sitemap.xml` (see [Revising a build](#revising-a-build)) | Commit straight to `main` and push. No pull request. |
| Anything else: `CLAUDE.md`, `index.html`, `stats.js`, `README.md`, `.nojekyll`, the manifest's format, the head block's format | A branch and a pull request for the owner to review |

Builds and revisions go to `main` even when the session was set up with a
branch of its own.

`main` has a ruleset that blocks force-pushes and deleting the branch. Normal
pushes are allowed. If a push is rejected because `main` moved, run
`git pull --rebase origin main` and push again.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | The front page: every build, newest first, read from `builds.json` |
| `builds.json` | The manifest: one entry per build |
| `sitemap.xml` | Every page's URL for search engines, generated from `builds.json` |
| `stats.js` | Page counts (GoatCounter). Every page loads it; the site code lives only here |
| `<slug>/` | One build. `slug` is `YYYY-MM-DD-short-name`, dated the day it was built |
| `.nojekyll` | Tells Pages to serve files as they are |

Never delete or rename a build folder: links to it may exist. To retire one,
leave it and say so on its page.

## The manifest

`builds.json` is a JSON array, oldest first. Append one entry per build:

```json
{
  "slug": "2026-10-12-tide-clock",
  "title": "Tide Clock",
  "date": "2026-10-12",
  "kind": "idea",
  "form": "tool",
  "style": "nautical chart",
  "summary": "A clock face that tells tide time instead of sun time.",
  "source": "idea-tank#7",
  "revised": "2026-10-15"
}
```

- `kind`: `question`, `idea`, `musing`, or `follow-up`.
- `form`: what the build is, in a word or two (see [Forms](#forms)).
- `style`: its visual style, in a few words (see [Styles](#styles)).
- `summary`: one public-safe line. It appears on the front page.
- `source`: where the build came from, for runs to detect a build they
  already made. `idea-tank#N` for idea-tank issue N.
- `revised`: optional. The date of the build's latest major revision (see
  [Revising a build](#revising-a-build)). Left out until the build is first
  revised that way, and not changed by a small tweak. The front page shows
  it.

## Variety

Before choosing, read the last three entries. Pick a `form` and a `style` that
none of them used, unless the idea plainly calls for one. Name the style
honestly in the manifest: two builds both called "minimal dark" count as the
same style. A revision does not add or move an entry, so it does not change
which three are last.

The kind sets the build's job:

| Kind | The build's job |
| --- | --- |
| `question` | Answer it and show the reasoning |
| `idea` | Make it, or a first slice of it; a proposal page if it needs more than a static site |
| `musing` | Explore it |
| `follow-up` | Research it, then build from what turned up |

### Forms

A menu, not a limit: explainer, interactive lab or simulation, tool or
calculator, toy, game, visual essay, data story, field guide, timeline,
decision aid, annotated map, proposal (for anything that needs more than a
static page: what it would be, how it would work, the first milestones).

Avoid the lazy moves: "X but with a chatbot", "gamified X", a quiz or
flashcards about X, a generic landing page about X.

### Styles

Also a menu: blueprint, newspaper front page, terminal, risograph print,
field notebook, museum placard, 8-bit, brutalist, Swiss poster, botanical
plate, nautical chart, pulp magazine, subway signage, receipt paper, chalk
board, vintage manual. Invent others. A style is more than a color scheme:
type, layout, and texture should all commit to it.

## Build rules

Every build is a static site in its own folder, unless it is a proposal page
for something bigger.

- `index.html` at the folder root, no build step. Plain HTML, CSS, and JS
  (ES modules are fine). Libraries only from a CDN (jsdelivr, cdnjs, unpkg),
  pinned to an exact version.
- **No backend.** A build runs entirely in the browser. Nothing a visitor
  enters, records, or plays is sent to a server.
- **Outside calls are optional and reputable.** A CDN library, a public API,
  or the visit counter may fail to load, so the build still works, or says
  plainly what is missing, when one does. Only from sources you can place: the
  CDNs above, an API's own documented endpoint, GoatCounter. No ad or tracking
  scripts. The counter is loaded only by `stats.js`; a build never loads it,
  or any other analytics, itself. "Nothing leaves your device" in a build
  means no backend, and is true with these calls.
- Every path relative: Pages serves the build under `/tidepool/<slug>/`.
- **The head block**, in every page's `<head>` right after `<title>`, between
  `<!-- site:head -->` and `<!-- /site:head -->`: the search and sharing tags
  and the counter. Search engines may index tidepool; the owner's
  `github.io` home page just does not link to it. Idea-tank's
  `tools/site.py sync` writes the block from the manifest entry, so a run
  never writes it by hand. Without that tool, copy the block from the
  newest build and change every value:
  - `<meta name="description">` and `og:description`: the entry's `summary`
  - `<link rel="canonical">` and `og:url`: `https://jkastl.github.io/tidepool/<slug>/`
  - `og:type` `article`, `og:site_name` `tidepool`, `og:title` the entry's
    `title`, and `<meta name="twitter:card" content="summary">`
  - a `application/ld+json` script: a schema.org `CreativeWork` with the
    title, summary, URL, `datePublished` (the entry's `date`),
    `dateModified` (its `revised`, if set), and `isPartOf` the tidepool
    `WebSite`
  - `<script src="../stats.js" defer></script>`

  No author, name, or anything else about the owner, in this block or
  anywhere. No `noindex`. No `og:image` (no screenshots, per below).
- **A line in `sitemap.xml`** for each build: its URL and a `lastmod` of
  its `revised` date, or its `date` if never revised. The front page's line
  takes the newest of those. `tools/site.py sync` writes the whole file.
- A small link back to the front page (`../`) somewhere unobtrusive.
- `<link rel="icon" href="data:,">` in every page's `<head>`. It declares an
  empty icon, so browsers never request a missing `/favicon.ico`. No emoji or
  decorative icons.
- State in `localStorage` or IndexedDB, inside try/catch, with export and
  import for anything someone would hate to lose.
- Public APIs only if they need no key and allow browser (CORS) calls.
- Works at phone width, and follows light and dark with
  `prefers-color-scheme`.
- Text and source only. No dependency folders, build output, or file over
  1 MB. No screenshots committed.

### People and current events

Builds are about ideas, not people.

- **Never about a living person.** Not a profile, not their news, not their
  posts, not a ranking of them. A living person may be named in passing for
  a documented public role, when the build is not about them.
- **Never about news involving people.** Current events about a technology,
  a natural event, or a policy as policy are fine.
- **Historical people are fine:** people who have died and are discussed for
  their place in history, not current controversy. If in doubt, treat the
  person as living.

A build about current events (never about people) makes public claims, so:

- Put the snapshot date at the top ("as of Oct. 12, 2026").
- Attribute every factual claim to the named outlet that reported it, with a
  link, and add nothing beyond what those reports say.

### Prior art in a build

Idea-tank runs check what already exists before building an idea, and a
build may say what turned up, in a short section such as "Already out
there". Other people's work is theirs, so:

- **Name and link, nothing else of theirs.** Use the product's or project's
  name in plain text and link to its own page. No logos, icons,
  screenshots, product photos, embedded media, or text copied from their
  site, docs, or marketing. Describe each one in the build's own words, in
  a line.
- **Names identify, never brand.** A name appears only to say what the
  thing is. It never goes in the build's title, slug, headings used as
  branding, or `builds.json` summary. Nothing may suggest the build is
  affiliated with, endorsed by, or a version of the other work: not "an
  open-source Spotify", but "an open-source music player".
- **No borrowed look or code.** Do not imitate another product's
  interface, layout, colors, or mascot, and do not copy its code, even
  when its license would allow it. Libraries from a CDN, per the build
  rules, are fine.
- **Fair and factual.** Say plainly what this build tries, not that the
  other thing is bad or missing something (see [Tone](#tone)). State only what their own pages or a named source say
  about them, and do not guess at prices or features.
- **Projects, not people.** Name the project, not the person behind it. A
  creator may be named only in passing for a documented public role, as in
  [People and current events](#people-and-current-events).

## Tone

A build is a first try at something interesting, shared the way a hobbyist
shares notes with a friend: curious, modest, and plain. It is not an expert
arriving to fix a field, and it should never read like one.

- **No first person.** A build has no narrator: no "I", "me", "my", or
  "we", and no asides like "the part that caught my eye". Talk about the
  topic, "this page", or "you". The hobbyist above is an attitude, not a
  character on the page.
- **No grand framing.** Not "what X really needs", "what X is really
  about", "the real problem is", "the missing piece", "what nobody talks
  about", or "finally". Say what the build does.
- **Other work is not a gap to fill.** An "Already out there" section says
  what exists and what this one tries, not what the others fail to do.
  Assume their makers thought of the obvious and had their reasons.
- **Modest claims.** Say where the build simplifies, estimates, or guesses.
  Not "everything you need", "the definitive", or "the right way".
- **Plain words.** Short sentences and everyday vocabulary. A style can be
  playful or dramatic in its type and layout; the prose still talks like a
  person, not a manifesto.

For example: "The real basics are electrical" reads as a correction nobody
asked for. "A lot of the early questions turn out to be about power and
wiring, so that's where this starts" says the same thing kindly.

## Revising a build

After a build is published, its owner sometimes asks for changes: a topic
expanded, a section added, a visual tweak, a correction. This is the path
for those.

There are two sizes of change, and only the first one counts as a revision
on the record:

| Change | Examples | `revised` | Commit |
| --- | --- | --- | --- |
| **Major revision**: changes what the build says or does | A new section, an expanded topic, a new control or feature, a corrected fact | Set to today | `Revise <slug>: <what changed>` |
| **Small tweak**: leaves what it says and does alone | Head block and other meta tags, the counter, sitewide boilerplate, a typo, a polished sentence, a small visual fix | Left as it is | `Tweak <slug>: <what changed>`, or `Tweak all builds: <what changed>` for one change across every build |

If unsure, it is a tweak. Everything below applies to both, except where it
says `revised`.

- **Who.** Only an interactive session, and only for a specific change
  the owner asked for. Scheduled runs never change a published build. A
  capture that asks for more on a built idea gets a new build, never an
  edit.
- **Needs idea-tank too.** Before pushing, a revision passes the same
  privacy check as a new build, and that check lives in the private
  idea-tank repo. A session that has only tidepool does not push a
  revision: it asks for idea-tank to be attached. The full procedure is
  idea-tank's `CLAUDE.md`, "Revising a published build".
- **Where.** Edit files inside the existing `<slug>/` folder and its
  `builds.json` entry, then commit straight to `main`. The slug, the folder
  name, and the URL never change, even if the topic grows. Nor do the
  entry's `date`, `kind`, or `source`. Update `title`, `summary`, `form`,
  or `style` only if the change makes them wrong. A change to `title` or
  `summary` also changes the head block, so resync it (see
  [Build rules](#build-rules)).
- **Scope.** Keep the build's form and style unless the owner asks to
  change them. If the ask is big enough to be a different build (a new
  form, a different topic), say so and offer a new build instead.
- **Rules.** Everything in [Build rules](#build-rules) still holds,
  including [People and current events](#people-and-current-events). A
  revision cannot turn a build into something a new build could not be.
- **Test.** As in [Test before publishing](#test-before-publishing): the
  changed parts and the core experience, desktop and phone width, light and
  dark, no console errors.
- **Record.** For a major revision, set `revised` on the entry to today's
  date, resync the head block and `sitemap.xml` (both carry the date), and
  commit the change and the entry together as
  `Revise <slug>: <what changed>`, for example
  `Revise 2026-10-14-slide-to-screen: add an image-pyramid diagram to the viewer`.
  For a small tweak, leave `revised` alone and commit as
  `Tweak <slug>: <what changed>`.

## Test before publishing

Serve the repo root with `python3 -m http.server` and drive the build with
Playwright using the preinstalled Chromium (if a project needs a different
Playwright version, launch with `executablePath: '/opt/pw-browsers/chromium'`;
never run `playwright install`). Open `/<slug>/`, walk the core experience
start to finish, use every control, check the console for errors, and look
at it at desktop and phone width, in light and dark. Also check the front
page lists the new build, or shows the revised date for a major revision,
and that idea-tank's `tools/site.py check` passes. Locally `stats.js` does
nothing, so tests never count as visits. Fix what you find before pushing.
