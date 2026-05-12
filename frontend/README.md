# Bee Dashboard Frontend

Bee Dashboard Frontend is a React + Vite web application for OSINT-oriented news intelligence. It connects to the Bee API backend and provides authenticated dashboards, news review, OSINT source management, Word List monitoring, investigation records, notes, and relationship graph analysis.

## Features

- Authenticated single-page application with protected routes.
- Dashboard KPIs and OSINT analytics.
- General WEB/TEXT sentiment report with donut chart and source table.
- News list with sentiment labels, entity tags, detail modal, source links, and pagination.
- OSINT source CRUD with active/inactive toggles.
- Word List monitoring with manual search execution, matched news, source summary, and processing animation.
- Notes editor with Markdown support and image uploads.
- Investigation records with personal data, phones, addresses, social links, notes, and document uploads.
- Interactive relationship graphs powered by Cytoscape.
- Graph node context menus, layouts, import/export actions, record import, investigation actions, and document download support.
- Open-tab navigation inside the app shell.
- English UI.

## Tech Stack

- React 19
- Vite 7
- React Router 7
- TanStack React Query
- Axios
- Bootstrap 5 and Bootstrap Icons
- ApexCharts / React ApexCharts
- Cytoscape and Cytoscape extensions
- React Markdown with GFM and sanitized rendering
- Sass
- ESLint and Prettier

## Project Structure

```text
frontend/
├── public/                       # Static public files
├── src/
│   ├── assets/                   # Brand assets, images, graph icons
│   ├── components/               # App shell components
│   │   └── header/               # Header dropdown and notifications
│   ├── contexts/                 # React contexts, including auth
│   ├── layout/                   # Default application layout
│   ├── lib/                      # Axios instance, UI wrappers, icons
│   ├── scss/                     # Global styles and vendor styles
│   ├── views/                    # Feature screens
│   │   ├── dashboard/            # Dashboard analytics
│   │   ├── graph/                # Relationship graph workspace
│   │   ├── news/                 # News list and detail modal
│   │   ├── notes/                # Notes editor
│   │   ├── osintSources/         # OSINT source management
│   │   ├── pages/                # Login and error pages
│   │   ├── records/              # Investigation records
│   │   └── wordList/             # Word List monitoring
│   ├── _nav.js                   # Sidebar navigation config
│   ├── App.js                    # Router and auth gate
│   ├── index.js                  # React entry point
│   ├── routes.js                 # App route definitions
│   └── store.js                  # Redux UI/theme store
├── index.html                    # Vite HTML entry
├── package.json                  # Scripts and dependencies
├── vite.config.js                # Vite config
└── README.md
```

## Requirements

- Node.js 20 or newer recommended
- npm 10 or newer recommended
- Bee API backend running locally or remotely

The current Axios client is configured to use:

```text
http://localhost:8000/api/v1
```

This is defined in:

```text
src/lib/axios.js
```

If the backend runs elsewhere, update `baseURL` there or refactor it to use a Vite environment variable.

## Installation

From the frontend directory:

```bash
npm install
```

## Running Locally

Start the backend first, then run:

```bash
npm start
```

Vite will start the development server, usually at:

```text
http://localhost:5173
```

Open the app in the browser and log in using a backend user. For local development, the backend README documents the default admin user created by `default_user.py`.

## Available Scripts

| Script | Command | Description |
| --- | --- | --- |
| `start` | `vite` | Start the Vite development server. |
| `build` | `vite build` | Build the production bundle into `dist/`. |
| `serve` | `vite preview` | Preview the production build locally. |
| `lint` | `eslint` | Run ESLint. |

Examples:

```bash
npm start
npm run build
npm run serve
npm run lint
```

## Backend Connection

All API calls go through the shared Axios instance:

```text
src/lib/axios.js
```

The client:

1. Uses `http://localhost:8000/api/v1` as the API base URL.
2. Reads `access_token` from `localStorage`.
3. Adds `Authorization: Bearer <token>` to requests when a token exists.
4. Redirects to `/login` when the backend returns `401`.

## Authentication Flow

Authentication is handled by:

```text
src/contexts/AuthContext.js
src/App.js
src/views/pages/login/Login.js
```

Flow:

1. The login page sends credentials to `/auth/login`.
2. The returned token is stored in `localStorage` as `access_token`.
3. `AuthContext` calls `/auth/me` to load the current user.
4. `AuthGate` protects all routes except `/login`, `/404`, and `/500`.
5. On logout or `401`, the token is removed and the app returns to `/login`.

## Main Screens

### Dashboard

Path:

```text
/dashboard
```

Includes:

- Global KPI cards.
- General WEB/TEXT sentiment breakdown.
- Source-level sentiment table.
- Top places by activity.
- Trending terms.
- Most active OSINT sources.

Backend endpoints used include:

```text
/dashboard/kpis
/dashboard/sentiment
/dashboard/locations
/dashboard/term-trends
/dashboard/source-activity
```

### News

Path:

```text
/news
```

Includes:

- Paginated recent news.
- Source, date, author, summary, and entity tags.
- Sentiment label per article.
- Detail modal.
- External source link.

Backend endpoints:

```text
/news/
/news/{id}
```

### OSINT Sources

Path:

```text
/osint-sources
```

Includes:

- Source table.
- Search.
- Create source.
- Edit source.
- Delete source.
- Active/inactive toggle.

Backend endpoints:

```text
/osint-sources
/osint-sources/{source_id}
```

### Word List

Path:

```text
/word-list
```

Includes:

- Word List selector.
- Create/delete Word Lists.
- Summary metrics.
- Top sources for matched news.
- Matched news list with pagination.
- Play button that starts backend search processing.
- Processing animation while the manual search task is active.

Backend endpoints:

```text
/word-lists
/word-lists/{word_list_id}
/word-lists/{word_list_id}/run
/word-lists/{word_list_id}/refresh
```

### Notes

Path:

```text
/notes
```

Includes:

- Markdown editor.
- Formatting toolbar.
- Image upload.
- Notes list and search.
- Create, update, and delete notes.

Backend endpoints:

```text
/notes/
/notes/{id}
/notes/images
```

### Records

Path:

```text
/records
```

Includes:

- Investigation record list.
- Record search.
- Create and edit records.
- Phones, addresses, social links, notes.
- Document upload, download, and delete.
- Record detail modal.

Backend endpoints:

```text
/records/
/records/{id}
/records/{id}/documents
/records/documents/{doc_id}/download
/records/documents/{doc_id}
```

### Graphs

Paths:

```text
/graph
/graph/:id
```

Includes:

- Graph selection and creation.
- Interactive Cytoscape workspace.
- Node and relationship creation.
- Node detail panel.
- Notes per graph node.
- Context menu actions.
- Graph layout controls.
- Record import into graph.
- Person-node investigation.
- Graph export/import actions.
- Graph and entity deletion flows.

Backend endpoints are served under `/graph` for frontend compatibility and `/graphs` as the canonical API namespace.

## Routing

Routes are declared in:

```text
src/routes.js
```

Navigation items are declared in:

```text
src/_nav.js
```

The main layout is:

```text
src/layout/DefaultLayout.js
```

## Styling

Global styles live in:

```text
src/scss/style.scss
```

The app uses Bootstrap, Bootstrap Icons, and custom SCSS. Most feature-specific visual rules are currently centralized in `style.scss`.

## Building for Production

Create a production build:

```bash
npm run build
```

The output is generated in:

```text
dist/
```

Preview the production build locally:

```bash
npm run serve
```

## Deployment Notes

- Serve the `dist/` directory with any static hosting solution.
- Configure the backend CORS `ALLOWED_ORIGINS` to include the frontend URL.
- Update `src/lib/axios.js` if the API URL is not `http://localhost:8000/api/v1`.
- For browser refresh support on nested routes, configure your web server to fall back to `index.html`.

Example Nginx SPA fallback:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Development Guidelines

- Keep API calls centralized through `src/lib/axios.js`.
- Use React Query for server state and cache invalidation.
- Keep route labels and sidebar labels synchronized when adding screens.
- Prefer existing Bootstrap/CoreUI-style wrappers from `src/lib/ui.js`.
- Keep feature changes scoped to the relevant view under `src/views`.
- Run `npm run build` before delivering UI changes.

## Quality Checks

Run ESLint:

```bash
npm run lint
```

Build verification:

```bash
npm run build
```

Format selected files with Prettier:

```bash
npx prettier --write src
```

## Common Issues

### The app redirects to `/login`

The access token is missing or invalid. Log in again. If the backend was restarted or the `SECRET_KEY` changed, existing tokens become invalid.

### API requests fail with CORS errors

Update backend `ALLOWED_ORIGINS` to include the frontend origin, for example:

```env
ALLOWED_ORIGINS=["http://localhost:5173"]
```

### API requests fail with network errors

Check that the backend is running at:

```text
http://localhost:8000/api/v1
```

If it is not, update `src/lib/axios.js`.

### The graph screen renders but interactions fail

Check browser console errors and verify that graph data is available from the backend. Some graph actions require a selected graph and selected node.

### Build warns about large chunks

Vite may warn that graph or dashboard chunks are large because Cytoscape and chart libraries are heavy. This is a warning, not a build failure. Future optimization can split graph/dashboard modules with dynamic imports or manual chunks.

## License

The frontend is covered by the repository-level Apache License 2.0. See [`../LICENSE`](../LICENSE) for the authoritative license terms.

Contribution guidelines are centralized at [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
