# Kanban Board

A clean, minimal personal Kanban board built with React, TypeScript, and Tailwind CSS.

## Features

- **5 columns**: Ideas → Backlog → To Do This Week → Works In Progress → Done
- **Drag & drop** between columns and reorder within columns (dnd-kit)
- **Cards** with optional description, priority (Low/Medium/High), and due date
- **Priority filter** to focus on specific priority levels
- **WIP warning** when more than 3 cards are in progress
- **"Add This Week"** quick action on Ideas & Backlog cards
- **"Clear Done"** to remove all completed tasks
- **Keyboard shortcut**: Press `N` to open new task modal
- **localStorage persistence** — your board state survives refreshes

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
```

Output is in the `dist/` folder.
