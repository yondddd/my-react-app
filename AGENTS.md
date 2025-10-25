# Repository Guidelines

## Project Structure & Module Organization
The Vite-powered React app lives in `src/`, with `src/main.jsx` bootstrapping the root and `App.jsx` orchestrating page layout. Reusable widgets stay in `src/components/`, each paired with a `.css` file; co-locate new styles and keep component names aligned with filenames. Conversion logic for PNG, TIFF, and EXIF handling lives in `src/utils/ImageConverter.js`; extend this module rather than scattering canvas or metadata helpers. Place bundle-aware images in `src/assets/` and `public/` for static files served verbatim (favicons, `robots.txt`). Build artifacts land in `dist/` and should remain untracked.

## Build, Test, and Development Commands
Install dependencies with `pnpm install` (the repo tracks `pnpm-lock.yaml`). `pnpm dev` launches the Vite dev server at `http://localhost:5173` with hot reloading. `pnpm build` generates an optimized bundle in `dist/`. `pnpm preview` serves the `dist/` bundle locally to validate production output. `pnpm lint` runs ESLint across the workspace; use it before pushing.

## Coding Style & Naming Conventions
Prefer modern functional React components and hooks; avoid class components unless justified. Use `PascalCase` for components and filenames (for example, `SvgConverter.jsx`), `camelCase` for functions and variables, and `UPPER_SNAKE_CASE` for constants. Indent with two spaces, keep imports grouped by module path, and co-locate component CSS. ESLint enforces recommended JS rules plus a relaxed unused-vars rule for uppercase globals—run linting to catch formatting drift.

## Testing Guidelines
Automated testing is not yet configured. When introducing tests, add Vitest with React Testing Library, place specs as `*.test.jsx` beside the related source, and expose them via a `pnpm test` script. Until a suite exists, perform manual smoke checks across upload, DPI selection, progress, and download flows before merge. Target at least 70% coverage once the harness lands and expand `ImageConverter` edge-case coverage alongside new features.

## Commit & Pull Request Guidelines
Use imperative, present-tense commit messages (for example, `feat: add DPI selector validation`); include scope or module when helpful. Group related changes per commit and ensure lint passes before pushing. Open PRs with a concise summary, screenshots or GIFs for UI tweaks, reproduction steps for bug fixes, and links to any tracking issues. Note manual test results in the PR description to speed up reviews.
