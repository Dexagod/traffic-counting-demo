import React, { useEffect, useState } from "react";
import MapView from "./Map";

/** Centralized theme (edit once, used everywhere) */
const THEME_CSS = `
:root{
  --color-primary: #2563eb;   /* primary */
  --color-secondary: #06b6d4; /* secondary */
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #111827;
  --color-border: #e5e7eb;
}

/* Base layout */
*{ box-sizing: border-box; }
html, body, #root { width: 100vw; height: 100vh; }
.app { height: 100%; background: var(--color-bg); display: flex; flex-direction: column; }

/* Header */
.header {
  height: 56px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.title { font-weight: 600; font-size: 16px; color: var(--color-text); }

/* Right action group */
.actions { display: flex; align-items: center; gap: 8px; }
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; font-size: 14px; text-decoration: none;
  color: var(--color-text); background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: 8px;
  transition: background .15s, border-color .15s, color .15s;
}
.btn:hover {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.logo {
  height: 28px; width: 28px; display: block; object-fit: contain;
  border-radius: 4px; background: var(--color-surface); border: 1px solid var(--color-border);
}

/* Main */
.main { flex: 1 1 auto; min-height: 0; }
`;

export default function App() {

  const [state, setState] = useState("Initializing application")

  return (
    <div className="app">
      {/* Inject centralized theme */}
      <style>{THEME_CSS}</style>

      <header className="header">
        <div className="title">DeployEMDS Vehicle Counting Demonstrator</div>
        <nav className="actions" aria-label="Header links">
          <a
            href="https://github.com/your-org/your-repo"
            target="_blank"
            rel="noreferrer noopener"
            className="btn"
          >
            GitHub
          </a>
          <a
            href="https://your-project-link.example"
            target="_blank"
            rel="noreferrer noopener"
            className="btn"
          >
            Project
          </a>
          <a
            href="https://www.example.edu"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Ghebt University"
          >
            {/* Put your real logo in /public and update the path if needed */}
            <img src="/ghebt-university-logo.svg" alt="Ghebt University" className="logo" />
          </a>
        </nav>
      </header>

      <main className="main">
        <div id="status">
          <StatusField state={state} />
        </div>
        <MapView setState={setState} />
      </main>
    </div>
  );
}

function StatusField(props: {state: string}) {
  return (
    <p>
      {props.state}
    </p>
  )
}

