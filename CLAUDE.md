# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static HTML/CSS/JS prototype demonstrating the "Wix Vibe" product flows feature. It simulates a website builder interface that auto-generates E2E tests from detected product flows. The prototype is a proof-of-concept with no build system or dependencies.

## Running the Project

Open `wix-vibe-product-flows-prototype.html` directly in a browser. No build step or server required.

## Architecture

**Single HTML Entry Point**: `wix-vibe-product-flows-prototype.html`
- Contains all markup including multiple "screens" (landing, editor) and modal overlays
- Screens are toggled via CSS classes (`.active`)

**JavaScript** (`js/`):
- `data.js`: All state and configuration data
  - `FLOWS`: Product flow definitions with test steps and Playwright code
  - `VERSIONS`: Version history for the visual diff feature
  - `FLOW_NODES` / `FLOW_EDGES`: Canvas-based user flow diagram data
  - Global state variables (`currentScreen`, `currentPage`, `flowStates`, etc.)
- `app.js`: UI logic and interactions
  - Screen transitions and page navigation
  - Flow canvas rendering with pan/zoom
  - Version control timeline and visual diff system
  - Test runner simulation (fake async execution)
  - Code syntax highlighting

**CSS** (`css/styles.css`):
- Single stylesheet with all styles
- CSS custom properties in `:root` for theming
- Organized by sections: screens, components, modals, utilities

## Key UI Components

- **Landing Screen**: Prompt input with auto-typing animation
- **Editor Screen**: Three tabs (Site, Dashboard, Code) with chat panel and site preview
- **Product Flows Page**: Test cases tab with flow cards + User Flows tab with interactive canvas
- **Modals**: Visualize (step-by-step flow preview), Code (syntax-highlighted Playwright tests), Visual Diff (side-by-side mockups)

## Naming Conventions

- CSS classes use prefixes: `ts-` for ToolShare site mockup, `fn-` for flow nodes, `vc-` for version control, `vdiff-` for visual diff
- DOM IDs follow patterns: `flowCard{idx}`, `siteHome`/`siteCatalog` for page content
- Functions exposed to `window` object for inline onclick handlers
