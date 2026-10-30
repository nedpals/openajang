---
name: OpenAjang
description: A small JSON format for publishing public events at a URL.
colors:
  background: "#fff"
  foreground: "#1a1a1a"
  muted: "#5c5c5c"
  line: "#ddd"
  web-blue: "#0b5fc4"
  code-surface: "#f4f4f4"
  error: "#b3261e"
  success: "#1b6e3c"
  dark-background: "#151515"
  dark-foreground: "#ececec"
  dark-muted: "#a0a0a0"
  dark-line: "#333"
  dark-web-blue: "#7ab4ff"
  dark-code-surface: "#222"
  dark-error: "#ff8a80"
  dark-success: "#7bd89a"
typography:
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  code-input:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.875rem"
    lineHeight: 1.5
rounded:
  small: "4px"
spacing:
  half: "0.5rem"
  standard: "1rem"
  comfortable: "0.75rem"
components:
  event-input:
    backgroundColor: "{colors.code-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.small}"
    padding: "{spacing.half}"
    width: "100%"
---

# Design System: OpenAjang

## Overview

**Creative North Star: "The Open Handbook"**

The site is plain, clear, and functional. It presents material in a compact reading column, with familiar web conventions and controls that keep attention on the content and task.

**Key Characteristics:**

- A centered, narrow reading column.
- System typography and recognizable links.
- Flat surfaces with light and dark color schemes.
- Familiar, functional controls.

## Colors

Web Blue marks links against neutral surfaces; muted gray supports secondary text and borders. Code and input surfaces have a subtle tonal separation. Green and red communicate validation results. Each role switches to its dark counterpart with the user's color-scheme preference; values are defined in the frontmatter and in `src/layouts/Base.astro`.

## Typography

Body text uses the system sans-serif stack at 16px with a 1.6 line height. Headings retain browser size and weight defaults with a 1.25 line height. The home-page lead is 1.25rem; the footer is 0.875rem. Code uses browser monospace styling at 0.9em, and the event input uses the monospace stack listed above.

## Layout

Header, main content, and footer share a centered maximum width of 46rem and 1rem padding. The header and navigation wrap naturally as space narrows. Tables and preformatted blocks scroll horizontally when needed. There are no explicit viewport-width breakpoints in the shared styles.

## Elevation & Depth

Surfaces are flat, without authored shadows. Borders and subtle background differences provide separation.

## Shapes

Code surfaces and the event input use gently rounded 4px corners. Table cells and the input use thin borders. Other controls retain browser-native shape and states.

## Components

### Navigation

The bold brand link and a wrapping row of text links share a header separated from content by a thin border. Links use the accent color; the brand uses foreground color without an underline.

### Event input and controls

The validator uses a full-width monospace textarea with a tinted background, thin border, and 0.5rem padding. Its action row wraps, with 0.75rem gaps. Buttons and selects inherit the surrounding font and use 0.35rem by 0.75rem padding; their remaining styling and interaction states are browser defaults.

### Code and tables

Inline code and preformatted blocks use the code surface and small rounded corners. Preformatted blocks have 0.75rem padding. Tables have collapsed borders, left-aligned cells, and horizontal overflow.

### Validation feedback

Status text is semibold and uses success or error colors; a table provides diagnostic details when present.

## Do's and Don'ts

### Do:

- **Do** preserve the readable centered column and wrapping navigation.
- **Do** support both light and dark color schemes using the corresponding roles.
- **Do** keep controls familiar and functional.

### Don't:

- **Don't** introduce shadows as a default surface treatment.
