# Bee Dashboard Frontend

Bee Dashboard Frontend is a React + Vite web application for OSINT-oriented news intelligence. It connects to the Bee API backend and provides authenticated dashboards, news review, OSINT source management, Word List monitoring, investigation records, notes, and relationship graph analysis.

## Features

- Dashboard KPIs and OSINT analytics.
- Global sentiment analysis report with donut chart and source table.
- News list with sentiment labels, entity tags, detail modal, source links, and pagination.
- OSINT source CRUD with active/inactive toggles.
- Word List monitoring with manual search execution, matched news, and source summaries.
- Notes editor with Markdown support and image uploads.
- Investigation records with personal data, phones, addresses, social links, notes, and document uploads.
- Interactive relationship graphs powered by Cytoscape.
- Graph node context menus, layouts, import/export actions, record import, investigation actions, and document download support.

## Tech Stack

- React 19
- Vite 7
- React Router 7
- Redux
- React Query
- Axios
- Bootstrap 5
- ApexCharts
- Cytoscape
- React Markdown
- Sass
- ESLint
- Prettier

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
│   └── store.js                  # Global UI state store
├── index.html                    # Vite HTML entry
├── package.json                  # Scripts and dependencies
├── vite.config.js                # Vite config
└── README.md
```

## Requirements

- Node.js 20 or newer recommended
- npm 10 or newer recommended

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

The Vite development server will usually be available at:

```text
http://localhost:5173
```

Open the application in the browser and log in with a valid backend user account. The backend README includes the default admin user created by `default_user.py` for local development.

## Available Scripts

| Script | Command | Description |
| --- | --- | --- |
| `start` | `vite` | Start the development server. |
| `build` | `vite build` | Build the production bundle into `dist/`. |
| `serve` | `vite preview` | Preview the production build locally. |
| `lint` | `eslint` | Run ESLint. |

## Backend Connection

Shared API requests are handled through:

```text
src/lib/axios.js
```

The client:

1. Uses `http://localhost:8000/api/v1` as the default API base URL.
2. Reads `access_token` from `localStorage`.
3. Adds `Authorization: Bearer <token>` to authenticated requests.
4. Redirects to `/login` on `401 Unauthorized` responses.

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

- Global sentiment breakdown.
- Sentiment analysis by source.
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
- Article source, date, author, summary, and entity tags.
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
- Create and manage Word Lists.
- Summary metrics.
- Top sources for matched news.
- Paginated matched news list.
- Manual search execution through the backend.

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
- Investigation workflows for graph entities.
- Graph export/import actions.
- Graph and entity deletion tools.

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

The app uses Bootstrap and custom SCSS styles. Most feature-specific styles are centralized in `style.scss`.

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

## Quality Checks

```bash
npm run lint
npm run build
npx prettier --write src
