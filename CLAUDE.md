# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**
- `pnpm dev` - Start development server with hot module replacement
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build locally
- `pnpm lint` - Run ESLint on the codebase

**Package Management:**
- Uses `pnpm` as the package manager (evidenced by `pnpm-lock.yaml`)

## Architecture

This is a React + Vite application featuring an SVG converter tool. The application uses React 19 with Vite 7 for fast development and modern JavaScript features.

**Core Structure:**
- **Entry Point**: `src/main.jsx` - React application entry point using React 19's createRoot
- **Main Component**: `src/App.jsx` - Root application component that renders the SVG converter
- **Primary Feature**: `src/SvgConverter.jsx` - Main converter component with state management
- **Bundler**: Vite with `@vitejs/plugin-react` for Fast Refresh
- **Linting**: ESLint with React Hooks and React Refresh plugins using flat config
- **Styling**: CSS files imported directly into components

**Key Configuration:**
- `vite.config.js` - Minimal Vite configuration with React plugin
- `eslint.config.js` - ESLint flat config with React-specific rules and custom rule for unused vars
- `package.json` - Modern React 19 with Vite 7 and image processing dependencies

**File Structure:**
- `src/` - Source code directory
- `src/components/` - Reusable UI components
- `src/utils/` - Utility classes and helpers
- `public/` - Static assets served directly
- `dist/` - Build output directory (ignored by ESLint)

## SVG Converter Feature

The application is built around a comprehensive SVG converter tool with the following architecture:

**Main Component:**
- `src/SvgConverter.jsx` - Central component managing file upload, conversion settings, and state
- Handles file validation, format selection, DPI settings, and conversion progress
- Integrates all sub-components and the ImageConverter utility

**Reusable Utility:**
- `src/utils/ImageConverter.js` - Standalone utility class for image conversion
- Can be imported and used in other projects: `import { ImageConverter } from './utils/ImageConverter'`
- Supports SVG to PNG, JPEG, and TIFF conversion with DPI scaling and quality control
- Handles SVG dimension parsing, canvas rendering, and file download

**UI Components:**
- `src/components/FileUpload.jsx` - Drag-and-drop file upload component
- `src/components/DpiSelector.jsx` - DPI selection component (72, 150, 300)
- `src/components/ImagePreview.jsx` - Preview component showing original SVG and converted result
- `src/components/ProgressBar.jsx` - Progress indicator for conversion process

**Key Dependencies:**
- `html2canvas` - For rendering SVG to canvas
- `utif` - For TIFF format support with LZW compression
- `piexifjs` - For JPEG EXIF metadata handling
- `exif-js` - For image metadata handling
- `pngjs` - For PNG processing

**Main Features:**
- Drag-and-drop or click to upload SVG files
- Format selection (PNG, JPEG, TIFF) with quality control
- DPI selection (72, 150, 300) affecting output resolution
- Real-time preview of uploaded SVG and converted result
- Progress tracking during conversion
- Error handling and validation
- Download functionality for converted images
- Responsive design for mobile devices