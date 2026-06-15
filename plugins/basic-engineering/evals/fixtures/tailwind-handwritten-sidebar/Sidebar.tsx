import { useState } from "react";

interface Section {
  id: string;
  label: string;
  depth: number;
}

interface SidebarProps {
  title: string;
  subtitle: string;
  sections: Section[];
  commentCount: number;
  onSectionClick: (id: string) => void;
}

export function Sidebar({
  title,
  subtitle,
  sections,
  commentCount,
  onSectionClick,
}: SidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 3h10M2 7h10M2 11h6"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="sidebar-logo-text">{title}</span>
        </div>
        <div className="sidebar-subtitle">{subtitle}</div>
      </div>

      <nav className="sidebar-body">
        <div className="section-label">Outline</div>
        {sections.map((s) => (
          <button
            key={s.id}
            className={`outline-node${s.id === activeId ? " active" : ""}`}
            style={{ paddingLeft: 8 + s.depth * 16 }}
            onClick={() => {
              setActiveId(s.id);
              onSectionClick(s.id);
            }}
          >
            <span className="outline-label">{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="comment-count-label">{commentCount} comments</span>
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </div>
    </aside>
  );
}
