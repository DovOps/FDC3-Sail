---
sidebar_position: 4
---

# Development Guide

This guide is for **contributors** who clone the FDC3-Sail monorepo and work on Sail packages, tests, and documentation.

If you want to **run the Sail platform** without contributing, see [Run Sail](./run-sail). If you want to **embed a Desktop Agent in your own web app**, see [Getting Started](./getting-started).

## Prerequisites

- Node.js **24+**
- npm **11+**

```bash
nvm use 24
```

## Clone and install

```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
npm install
```

Always install from the **repository root**. Shared dev tooling (TypeScript, Vite, Vitest, ESLint, Prettier, and React type packages) lives in the root `package.json` and is hoisted for all workspaces. Workspace packages only declare package-specific dev dependencies (for example Cucumber in `@finos/sail-desktop-agent` or Playwright in `@finos/sail-web`). Run workspace scripts with `npm run <script> -w <workspace>` from the root — do not `cd` into a package and run `npm install` there.

### Run the full stack locally

```bash
npm run dev
```

Starts Desktop Agent (watch), platform API (watch), server stub, and Sail web UI on **http://localhost:3000**.

```bash
npm run dev:desktop   # Electron desktop mode (server + Electron shell)
npm run dev:harness   # FDC3 toolbox clean room on :3001
npm run docs:dev      # Documentation site (use --port 3002 if web app is running)
```

## Project Structure

FDC3 Sail is an npm workspace monorepo:

```
FDC3-Sail/
├── packages/          
│   ├── sail-desktop-agent/  # Pure FDC3 2.2 Desktop Agent (@finos/sail-desktop-agent)
│   ├── sail-platform-api/  # Platform services & transports (@finos/sail-platform-api)
│   ├── sail-ui/        # Shared React components
│   ├── sail-web/       # Browser-based Sail UI (@finos/sail-web)
│   ├── sail-conformance-harness/  # FDC3 toolbox clean room (@finos/sail-conformance-harness)
│   ├── sail-server/    # Node.js backend server (@finos/sail-server)
│   └── sail-electron/  # Electron desktop wrapper (@finos/sail-electron)
└── website/            # Documentation (Docusaurus)
```

## Internal and Development Packages

The main package docs focus on packages adopters are likely to use directly. These package docs are most useful when working inside the monorepo:

- [@finos/sail-ui](./packages/sail-ui/overview) - shared React components used by Sail apps.
- [@finos/sail-conformance-harness](./packages/conformance-harness/overview) - clean-room FDC3 toolbox host for conformance debugging.

## Common Commands

### Development

```bash
# Start browser-based development (most common)
npm run dev

# Start Electron desktop development
npm run dev:desktop

# FDC3 conformance toolbox host
npm run dev:harness

# Start documentation site
npm run docs:dev
```

### Code Quality

```bash
# Run all quality checks (recommended before commits)
npm run validate

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:fix
```

### Testing

```bash
# Unit tests (Vitest) - watch mode
npm run test

# Run tests once
npm test -- --run

# Desktop Agent tests (Vitest + Cucumber)
npm test -w @finos/sail-desktop-agent

# FDC3 Compliance tests (Cucumber BDD)
npm run test:cucumber
```

### Building

```bash
# Build publishable / CI workspaces (excludes sail-electron until fixed)
npm run build

# Documentation site
npm run docs:build

# Build specific workspace
npm run build --workspace=@finos/sail-platform-api

# Clean build artifacts
npm run clean
```

## Code Submission Process

### Before You Start

1. **Check for existing issues** - Search GitHub issues for related work
2. **Create an issue** - Describe your proposed changes and get feedback
3. **Fork the repository** - Create your own copy to work in

### Making Changes

#### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

#### 2. Development Standards

**Code Quality Requirements:**

Run `npm run validate` before commits. It runs the same gate as CI: Prettier, ESLint, TypeScript, workspace build, docs build, Vitest (`npm test -- --run`), and Cucumber (`npm run test:cucumber`).

Individual steps when iterating:

- `npm run lint` / `npm run lint:fix`
- `npm run typecheck`
- `npm run format` / `npm run format:fix`
- `npm run build` (CI workspaces; excludes `sail-electron` until fixed)
- `npm run docs:build`

#### 3. Quality Check Before Submission

```bash
# Run this before every commit (full CI gate)
npm run validate

# If a step fails, fix and re-run validate:
npm run lint:fix      # Lint
npm run format:fix    # Format
# Fix type errors manually, then:
npm run validate
```

### Commit Message Format

```bash
type: brief description

- More detailed explanation if needed
- Use bullet points for multiple changes
- Reference issue numbers: Fixes #123
```

**Common types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code restructuring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Key Technologies

- **TypeScript** - Type-safe JavaScript
- **React 19** - UI framework
- **Socket.IO** - Real-time communication
- **Zustand** - State management
- **Dockview** - Workspace layout management
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Vitest** - Testing framework
- **Cucumber** - BDD testing for FDC3 compliance

## Publishing packages (maintainers)

Public npm packages: `@finos/sail-desktop-agent` and `@finos/sail-platform-api`. Other workspaces are private and are not versioned or published.

Releases use [Changesets](https://github.com/changesets/changesets). Contributors do not need to add changesets; maintainers batch weekly (or per merge) on `main`.

### Weekly release ritual

1. Review merged PRs since the last release.
2. On `main`, add one or more changeset files (CLI or hand-written markdown):

   ```bash
   npm run changeset
   ```

   Example `.changeset/wcp-heartbeat-fix.md`:

   ```md
   ---
   "@finos/sail-desktop-agent": patch
   ---

   Fix heartbeat cleanup for canonical WCP5 instance ids (#123, #124).
   ```

3. Commit and push the `.changeset/` file(s) to `main`.
4. The **Release** GitHub Action opens or updates a **Version Packages** pull request (version bumps + `CHANGELOG.md` updates).
5. Merge the Version Packages PR. CI builds, publishes to npm, pushes git tags, and opens GitHub Releases.

Packages can ship independently and stay on different semver lines. Desktop Agent is in Changesets **pre** mode (`3.0.0-pre.x`); run `npx changeset pre exit` before the first stable `3.0.0` release.

### Prerequisites

- Repository secret `NPM_TOKEN` with publish access to the `@finos` scope on npm.
- Workflow: `.github/workflows/release.yml` (targets branch `main`).

## Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
