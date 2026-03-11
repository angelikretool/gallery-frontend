# Retool Custom Component Gallery — Private Source Repo

## What this repo is

This is the **private source of truth** for the Retool Custom Component Gallery frontend.
It is a single-file static site (`index.html`) deployed to GitHub Pages via the public mirror repo.

- **Private repo (source):** `laboyangelik/retool-gallery-private`
- **Public repo (deployed):** `angelikretool/gallery-frontend`
- **Live site:** https://angelikretool.github.io/gallery-frontend/

All edits are made here, then pushed to the `public` remote to deploy.

---

## Directory structure

```
index.html                  # The entire frontend — one file, no build step
netlify/functions/lookup.js # DEPRECATED — do not use, pending deletion
netlify.toml                # DEPRECATED — do not use, pending deletion
CLAUDE.md                   # This file
```

There is no build process. Edit `index.html` directly.

---

## How to deploy

```bash
# Push to the public GitHub Pages repo
git push public main
```

The `public` remote points to `https://github.com/angelikretool/gallery-frontend`.
GitHub Pages serves from the `main` branch root.

---

## Git conventions

- All commits must be authored as `angelikretool` (`209033108+angelikretool@users.noreply.github.com`)
- **Never** add `Co-Authored-By` lines
- Commit with:
  ```bash
  git -c user.name="angelikretool" -c user.email="209033108+angelikretool@users.noreply.github.com" commit -m "message"
  ```

---

## How the gallery works

### Frontend (`index.html`)
- On load, fetches approved submissions from Retool via `GALLERY_WEBHOOK`
- Merges DB submissions with a small set of hardcoded featured components
- Cards link to `component_url` (merged folder in the gallery repo) if set, otherwise fall back to `pr_link`
- Supports an edit token flow: `?edit=TOKEN` pre-populates the submission form with prior data and shows AI reviewer feedback

### Retool backend
The gallery relies on several Retool Workflows and an Agent:

| Workflow | Purpose |
|----------|---------|
| `fetch-approved-submissions` | Returns all `status = 'accepted'` rows — powers the gallery cards |
| `validate-edit-token` | Looks up a submission by edit token — powers the `?edit=TOKEN` flow |
| `update-submission` | Updates an existing submission when a user re-submits via edit link |
| `saving-submission-db` | Saves a new submission and triggers the agent review |
| `review-decision` | Called by the agent — merges the PR, sets `component_url`, sends email |
| `scheduled-agent-review` | Runs the Reviewer Agent on a schedule (every hour) |

### Retool Database — `submissions` table
Key columns:
```
id, name, username, email, project_name, pr_link, about,
how_it_works, build_process, video_url, cover_image, tags,
edit_token, status, feedback, component_url, submitted_at, updated_at
```

- `status` values: `pending` → reviewed by agent → `accepted` or `flagged`
- `component_url` is set automatically by `review-decision` after the PR is merged (GitHub API derives the folder path from the PR files)
- `cover_image` must be a **public** Retool Storage URL (enable "Make file public on upload" in both upload workflows)

### Reviewer Agent
- Name: **Reviewer of Custom Components**
- Runs via the `scheduled-agent-review` workflow (hourly)
- Tools: `getPendingSubmissions`, `getSubmissionDetails`, `checkCommunityUsername`, `acceptSubmission`, `flagSubmission`
- `checkCommunityUsername` hits `https://community.retool.com/u/{username}.json` to verify the handle is real
- On accept: calls `acceptSubmission` → triggers `review-decision` → merges PR + sends email
- On flag: calls `flagSubmission` → stores feedback + sends email with `?edit=TOKEN` link

---

## How components enter the gallery

The full flow for a contributor:

1. **Build** the component using the official template:
   `https://github.com/tryretool/custom-component-collection-template`
   - One component per folder under `src/components/`
   - Must include TypeScript source, tests, README, and a cover image
   - Uses `npx retool-ccl dev` / `npx retool-ccl deploy`

2. **Submit a pull request** to the community gallery repo:
   `https://github.com/tryretool/custom-component-gallery`
   - Component goes in `components/YourComponentName/`
   - PR must be open before submitting the gallery form

3. **Submit the form** on the gallery website
   - Fills in project name, username (must be real Retool Community handle), PR link, about, how it works, build process, video, cover image
   - Submission is saved to the Retool DB with `status = 'pending'`

4. **Agent reviews** the submission (within the hour)
   - If accepted: PR is merged automatically, `component_url` is set to the merged folder, card goes live on the gallery
   - If flagged: contributor receives feedback email with a personal `?edit=TOKEN` link to fix and resubmit

5. **Gallery exhibition is optional**
   - Submitting to the gallery is not required to use the template or to merge a component
   - The gallery is a way to showcase and discover community components
   - The gallery website itself tells contributors: use the template first

---

## Key frontend constants (in `index.html`)

```javascript
const VALIDATE_WEBHOOK  // edit token lookup workflow
const UPDATE_WEBHOOK    // update submission workflow
const GALLERY_WEBHOOK   // fetch approved submissions workflow
// SUBMIT_WEBHOOK is defined inline in the submit handler
```

Do not commit API keys to the public repo. These keys are read-only workflow trigger keys — they only accept POST requests to predefined workflows.
