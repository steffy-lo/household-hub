import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#06080f",
  surface: "#0c1018",
  card: "#111827",
  border: "#1e2d42",
  borderBright: "#2a3f5f",
  accent: "#22d3ee",
  accentDim: "#0e7490",
  orange: "#f97316",
  green: "#22c55e",
  purple: "#a855f7",
  yellow: "#facc15",
  red: "#ef4444",
  text: "#e2e8f0",
  muted: "#64748b",
  mutedBright: "#94a3b8",
  pixel: "'Press Start 2P', monospace",
  mono: "'IBM Plex Mono', monospace",
  sans: "'DM Sans', sans-serif",
};

const DB_KEY = "main";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getWeekLabel(wk = getWeekKey()) {
  const [year, w] = wk.split("-W");
  const jan4 = new Date(Date.UTC(+year, 0, 4));
  const ws = new Date(jan4);
  ws.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (+w - 1) * 7);
  const we = new Date(ws);
  we.setUTCDate(ws.getUTCDate() + 6);
  const fmt = d => d.toLocaleDateString("en", { month: "short", day: "numeric" });
  return `${fmt(ws)} – ${fmt(we)}`;
}

function shiftWeek(wk, delta) {
  const [year, w] = wk.split("-W");
  const jan4 = new Date(Date.UTC(+year, 0, 4));
  const ws = new Date(jan4);
  ws.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (+w - 1) * 7);
  ws.setUTCDate(ws.getUTCDate() + delta * 7);
  return getWeekKey(ws);
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function DEFAULT_DATA() {
  const week = getWeekKey();
  return {
    members: [
      { id: "m1", name: "Alex", color: "#22d3ee", emoji: "🧑" },
      { id: "m2", name: "Jordan", color: "#f97316", emoji: "🧑" },
    ],
    duties: [
      { id: "d1", name: "Laundry", emoji: "🧺", weeklyRotation: { [week]: "m1" } },
      { id: "d2", name: "Floor Cleaning", emoji: "🧹", weeklyRotation: { [week]: "m2" } },
      { id: "d3", name: "Dishes", emoji: "🍽️", weeklyRotation: { [week]: "m1" } },
      { id: "d4", name: "Trash", emoji: "🗑️", weeklyRotation: { [week]: "m2" } },
      { id: "d5", name: "Bathroom", emoji: "🚿", weeklyRotation: { [week]: "m1" } },
    ],
    tasks: [],
    events: [],
    grocery: [],
    pixoo: { ip: "", brightness: 70, displayMode: "duties" },
  };
}

// ─── DATA LAYER ───────────────────────────────────────────────────────────────
async function dbLoad() {
  if (supabase) {
    const { data, error } = await supabase
      .from("household_data")
      .select("data")
      .eq("id", DB_KEY)
      .single();
    if (!error && data) return data.data;
  }
  // fallback to localStorage
  const raw = localStorage.getItem("hh_hub_v1");
  return raw ? JSON.parse(raw) : null;
}

async function dbSave(payload) {
  localStorage.setItem("hh_hub_v1", JSON.stringify(payload));
  if (supabase) {
    await supabase
      .from("household_data")
      .upsert({ id: DB_KEY, data: payload, updated_at: new Date().toISOString() });
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function injectGlobals() {
  document.head.insertAdjacentHTML("beforeend", `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{height:100%;background:${T.bg};color:${T.text};font-family:${T.sans}}
      ::-webkit-scrollbar{width:6px;height:6px}
      ::-webkit-scrollbar-track{background:${T.surface}}
      ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
      input,textarea,select{background:${T.surface};border:1px solid ${T.border};color:${T.text};border-radius:8px;padding:8px 12px;font-family:${T.sans};font-size:14px;outline:none;transition:border-color .2s}
      input:focus,textarea:focus,select:focus{border-color:${T.accent}}
      input::placeholder,textarea::placeholder{color:${T.muted}}
      button{cursor:pointer;font-family:${T.sans};transition:all .15s}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      @keyframes slideIn{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes spin{to{transform:rotate(360deg)}}
      .slide-in{animation:slideIn .25s ease}
      .checkbox{width:18px;height:18px;border:2px solid ${T.border};border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;background:transparent}
      .checkbox.checked{background:${T.accent};border-color:${T.accent}}
      .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fadeIn .15s ease}
      .modal{background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:24px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;animation:slideIn .2s ease}
      @media(max-width:640px){
        .modal{padding:16px}
        .hide-mobile{display:none!important}
      }
    </style>
  `);
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", style: sx = {}, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 };
  const sizes = { sm: { fontSize: 12, padding: "6px 12px" }, md: { fontSize: 13, padding: "8px 16px" }, lg: { fontSize: 14, padding: "10px 20px" } };
  const variants = {
    primary: { background: T.accent, color: "#000" },
    secondary: { background: T.surface, color: T.text, border: `1px solid ${T.border}` },
    danger: { background: T.red, color: "#fff" },
    ghost: { background: "transparent", color: T.mutedBright, border: `1px solid ${T.border}` },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }}>{children}</button>;
}

function Card({ children, style: sx = {}, onClick, glow }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: T.card, border: `1px solid ${hov && onClick ? T.borderBright : T.border}`, borderRadius: 12, padding: 20, cursor: onClick ? "pointer" : "default", transition: "all .2s", transform: hov && onClick ? "translateY(-2px)" : "none", boxShadow: glow ? `0 0 20px ${glow}22` : "none", ...sx }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
      <div>
        <h2 style={{ fontFamily: T.pixel, fontSize: 11, color: T.accent, letterSpacing: 1, marginBottom: sub ? 6 : 0 }}>{children}</h2>
        {sub && <p style={{ fontSize: 13, color: T.muted }}>{sub}</p>}
      </div>
      {action && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{action}</div>}
    </div>
  );
}

function MemberBadge({ member, size = "sm" }) {
  if (!member) return null;
  const dim = size === "sm" ? 22 : 30;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${member.color}22`, border: `1px solid ${member.color}44`, borderRadius: 999, padding: size === "sm" ? "2px 8px 2px 2px" : "3px 10px 3px 3px" }}>
      <div style={{ width: dim, height: dim, borderRadius: "50%", background: `${member.color}33`, border: `2px solid ${member.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size === "sm" ? 10 : 14 }}>{member.emoji}</div>
      <span style={{ fontSize: size === "sm" ? 11 : 13, fontWeight: 600, color: member.color }}>{member.name}</span>
    </div>
  );
}

function EmptyState({ icon, text, action }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 24px" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: action ? 16 : 0 }}>{text}</p>
      {action}
    </div>
  );
}

function Modal({ onClose, title, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
        {footer && <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "HOME", icon: "⌂" },
  { id: "duties", label: "DUTIES", icon: "🔄" },
  { id: "tasks", label: "TASKS", icon: "✓" },
  { id: "events", label: "EVENTS", icon: "📅" },
  { id: "grocery", label: "GROCERY", icon: "🛒" },
  { id: "pixoo", label: "PIXOO64", icon: "📺" },
  { id: "settings", label: "SETUP", icon: "⚙" },
];

function Header({ activeTab, setActiveTab, syncStatus, pixooConnected }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <header style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 16, height: 56 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, background: `${T.accent}22`, border: `1px solid ${T.accentDim}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>🏠</span>
          </div>
          <div className="hide-mobile">
            <div style={{ fontFamily: T.pixel, fontSize: 7, color: T.accent, letterSpacing: 2 }}>HOUSEHOLD</div>
            <div style={{ fontFamily: T.pixel, fontSize: 7, color: T.mutedBright, letterSpacing: 1 }}>HUB</div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ display: "flex", gap: 1, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, border: "none",
              background: activeTab === tab.id ? `${T.accent}20` : "transparent",
              color: activeTab === tab.id ? T.accent : T.muted,
              fontFamily: T.pixel, fontSize: 6, letterSpacing: 1, whiteSpace: "nowrap",
              borderBottom: activeTab === tab.id ? `2px solid ${T.accent}` : "2px solid transparent",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 12 }}>{tab.icon}</span>
              <span className="hide-mobile">{tab.label}</span>
            </button>
          ))}
        </nav>
        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Sync dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: `${syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red}15`, border: `1px solid ${syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red}44` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red, animation: syncStatus === "saving" ? "pulse 1s infinite" : "none" }} />
            <span style={{ fontFamily: T.mono, fontSize: 9, color: syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red }} className="hide-mobile">
              {syncStatus === "saved" ? "SYNCED" : syncStatus === "saving" ? "SAVING" : "OFFLINE"}
            </span>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.mutedBright }}>{time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    </header>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data, setActiveTab }) {
  const week = getWeekKey();
  const todayStr = new Date().toISOString().split("T")[0];
  const today = new Date();
  const pending = data.tasks.filter(t => !t.completed).length;
  const groceryLeft = data.grocery.filter(g => !g.checked).length;
  const todayEvents = data.events.filter(e => e.date === todayStr);
  const upcoming = [...data.events].filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const duties = data.duties.map(d => ({ ...d, assignee: data.members.find(m => m.id === d.weeklyRotation?.[week]) }));

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${T.accentDim}30, ${T.purple}18)`, border: `1px solid ${T.borderBright}`, borderRadius: 16, padding: "18px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 2, marginBottom: 6 }}>WEEK {week.split("-W")[1]} · {getWeekLabel()}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{today.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</h1>
        </div>
        <span style={{ fontSize: 40 }}>🏠</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Tasks Pending", value: pending, color: T.orange, icon: "✓", tab: "tasks" },
          { label: "Grocery Items", value: groceryLeft, color: T.yellow, icon: "🛒", tab: "grocery" },
          { label: "Today's Events", value: todayEvents.length, color: T.purple, icon: "📅", tab: "events" },
          { label: "Active Duties", value: data.duties.length, color: T.green, icon: "🔄", tab: "duties" },
        ].map(stat => (
          <Card key={stat.label} onClick={() => setActiveTab(stat.tab)} glow={stat.color} style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontFamily: T.mono, fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* 2-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {/* Duties */}
        <Card>
          <SectionTitle sub={getWeekLabel()} action={<Btn size="sm" variant="ghost" onClick={() => setActiveTab("duties")}>View →</Btn>}>THIS WEEK</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {duties.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{d.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</span>
                </div>
                {d.assignee ? <MemberBadge member={d.assignee} /> : <span style={{ fontSize: 11, color: T.muted }}>Unassigned</span>}
              </div>
            ))}
          </div>
        </Card>

        {/* Events */}
        <Card>
          <SectionTitle action={<Btn size="sm" variant="ghost" onClick={() => setActiveTab("events")}>View →</Btn>}>UPCOMING</SectionTitle>
          {upcoming.length === 0 ? <EmptyState icon="📅" text="No upcoming events" /> :
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map(ev => {
                const isToday = ev.date === todayStr;
                return (
                  <div key={ev.id} style={{ display: "flex", gap: 12, padding: "9px 12px", background: isToday ? `${T.purple}12` : T.surface, border: `1px solid ${isToday ? T.purple : T.border}`, borderRadius: 8 }}>
                    <div style={{ minWidth: 36, textAlign: "center" }}>
                      <div style={{ fontFamily: T.mono, fontSize: 8, color: T.muted }}>{new Date(ev.date + "T00:00:00").toLocaleDateString("en", { month: "short" }).toUpperCase()}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: isToday ? T.purple : T.text }}>{new Date(ev.date + "T00:00:00").getDate()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</div>
                      {ev.time && <div style={{ fontSize: 11, color: T.muted }}>⏰ {ev.time}</div>}
                    </div>
                    {isToday && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: T.purple, alignSelf: "center" }}>TODAY</span>}
                  </div>
                );
              })}
            </div>
          }
        </Card>

        {/* Tasks */}
        <Card>
          <SectionTitle action={<Btn size="sm" variant="ghost" onClick={() => setActiveTab("tasks")}>View →</Btn>}>RECENT TASKS</SectionTitle>
          {data.tasks.length === 0 ? <EmptyState icon="✓" text="No tasks yet" /> :
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...data.tasks].slice(-5).reverse().map(t => {
                const m = data.members.find(x => x.id === t.assignee);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, opacity: t.completed ? 0.5 : 1 }}>
                    <div className={`checkbox ${t.completed ? "checked" : ""}`}>{t.completed && <span style={{ fontSize: 9, color: "#000" }}>✓</span>}</div>
                    <span style={{ fontSize: 13, flex: 1, textDecoration: t.completed ? "line-through" : "none", color: t.completed ? T.muted : T.text }}>{t.title}</span>
                    {m && <MemberBadge member={m} />}
                  </div>
                );
              })}
            </div>
          }
        </Card>

        {/* Grocery */}
        <Card>
          <SectionTitle action={<Btn size="sm" variant="ghost" onClick={() => setActiveTab("grocery")}>View →</Btn>}>GROCERY</SectionTitle>
          {data.grocery.filter(g => !g.checked).length === 0 ? <EmptyState icon="🛒" text="All stocked up!" /> :
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.grocery.filter(g => !g.checked).slice(0, 7).map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13 }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{item.quantity || "1×"}</span>
                </div>
              ))}
              {data.grocery.filter(g => !g.checked).length > 7 && <p style={{ fontSize: 12, color: T.muted, textAlign: "center" }}>+{data.grocery.filter(g => !g.checked).length - 7} more</p>}
            </div>
          }
        </Card>
      </div>
    </div>
  );
}

// ─── DUTIES ───────────────────────────────────────────────────────────────────
function Duties({ data, save }) {
  const [viewWeek, setViewWeek] = useState(getWeekKey());
  const [showAdd, setShowAdd] = useState(false);
  const [newDuty, setNewDuty] = useState({ name: "", emoji: "🧹" });
  const isCurrent = viewWeek === getWeekKey();

  const assign = (dutyId, memberId) => save({ ...data, duties: data.duties.map(d => d.id === dutyId ? { ...d, weeklyRotation: { ...d.weeklyRotation, [viewWeek]: memberId || null } } : d) });

  const autoRotate = () => {
    const prev = shiftWeek(viewWeek, -1);
    save({ ...data, duties: data.duties.map(d => { const pi = data.members.findIndex(m => m.id === d.weeklyRotation?.[prev]); return { ...d, weeklyRotation: { ...d.weeklyRotation, [viewWeek]: data.members[(pi + 1) % data.members.length]?.id } }; }) });
  };

  const copyPrev = () => {
    const prev = shiftWeek(viewWeek, -1);
    save({ ...data, duties: data.duties.map(d => ({ ...d, weeklyRotation: { ...d.weeklyRotation, [viewWeek]: d.weeklyRotation?.[prev] || null } })) });
  };

  const addDuty = () => {
    if (!newDuty.name.trim()) return;
    save({ ...data, duties: [...data.duties, { id: uid(), ...newDuty, weeklyRotation: {} }] });
    setNewDuty({ name: "", emoji: "🧹" }); setShowAdd(false);
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>
      {/* Week nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 18px", marginBottom: 20 }}>
        <Btn size="sm" variant="ghost" onClick={() => setViewWeek(shiftWeek(viewWeek, -1))}>← Prev</Btn>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: isCurrent ? T.accent : T.muted, letterSpacing: 1 }}>WEEK {viewWeek.split("-W")[1]}{isCurrent ? " · NOW" : ""}</div>
          <div style={{ fontSize: 13, color: T.mutedBright, marginTop: 3 }}>{getWeekLabel(viewWeek)}</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={() => setViewWeek(shiftWeek(viewWeek, 1))}>Next →</Btn>
      </div>

      <SectionTitle sub="Assign household duties to members each week" action={<>
        <Btn size="sm" variant="ghost" onClick={copyPrev}>📋 Copy Last Week</Btn>
        <Btn size="sm" variant="ghost" onClick={autoRotate}>🔄 Auto-Rotate</Btn>
        <Btn size="sm" onClick={() => setShowAdd(true)}>+ Add</Btn>
      </>}>WEEKLY DUTIES</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {data.duties.map(duty => {
          const assignedId = duty.weeklyRotation?.[viewWeek];
          const assignee = data.members.find(m => m.id === assignedId);
          return (
            <Card key={duty.id} glow={assignee?.color}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{duty.emoji}</div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{duty.name}</span>
                </div>
                <button onClick={() => save({ ...data, duties: data.duties.filter(d => d.id !== duty.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 18 }}>×</button>
              </div>
              {assignee ? <div style={{ marginBottom: 12 }}><MemberBadge member={assignee} size="lg" /></div> :
                <div style={{ padding: "8px 12px", background: `${T.red}10`, border: `1px dashed ${T.red}40`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.muted }}>⚠ Unassigned</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.members.map(m => (
                  <button key={m.id} onClick={() => assign(duty.id, m.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: `2px solid ${m.id === assignedId ? m.color : T.border}`, background: m.id === assignedId ? `${m.color}22` : "transparent", color: m.id === assignedId ? m.color : T.mutedBright, fontSize: 12, fontWeight: 600 }}>{m.emoji} {m.name}</button>
                ))}
                {assignedId && <button onClick={() => assign(duty.id, null)} style={{ padding: "5px 10px", borderRadius: 999, border: `2px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 12 }}>✕</button>}
              </div>
            </Card>
          );
        })}
        <div onClick={() => setShowAdd(true)} style={{ border: `2px dashed ${T.border}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 140, cursor: "pointer", color: T.muted, gap: 8, fontSize: 14, transition: "all .2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
          <span style={{ fontSize: 22 }}>+</span> Add Duty
        </div>
      </div>

      {showAdd && (
        <Modal title="Add New Duty" onClose={() => setShowAdd(false)} footer={<><Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn onClick={addDuty}>Add</Btn></>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>EMOJI</label><input value={newDuty.emoji} onChange={e => setNewDuty(p => ({ ...p, emoji: e.target.value }))} style={{ width: 80 }} /></div>
            <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>NAME</label><input value={newDuty.name} onChange={e => setNewDuty(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Vacuuming" style={{ width: "100%" }} autoFocus onKeyDown={e => e.key === "Enter" && addDuty()} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
function Tasks({ data, save }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");
  const [newTask, setNewTask] = useState({ title: "", assignee: "", list: "General", dueDate: "" });

  const addTask = () => {
    if (!newTask.title.trim()) return;
    save({ ...data, tasks: [...data.tasks, { id: uid(), ...newTask, completed: false, createdAt: new Date().toISOString() }] });
    setNewTask({ title: "", assignee: "", list: "General", dueDate: "" }); setShowAdd(false);
  };

  const toggle = id => save({ ...data, tasks: data.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) });
  const del = id => save({ ...data, tasks: data.tasks.filter(t => t.id !== id) });

  const filtered = filter === "pending" ? data.tasks.filter(t => !t.completed) : filter === "done" ? data.tasks.filter(t => t.completed) : data.tasks;
  const lists = [...new Set(["General", ...data.tasks.map(t => t.list || "General")])];
  const byList = lists.reduce((acc, l) => { const items = filtered.filter(t => (t.list || "General") === l); if (items.length) acc[l] = items; return acc; }, {});

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>
      <SectionTitle sub="Shared household task lists" action={<>
        <div style={{ display: "flex", gap: 3, background: T.surface, borderRadius: 8, padding: 3, border: `1px solid ${T.border}` }}>
          {["all", "pending", "done"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: filter === f ? T.accent : "transparent", color: filter === f ? "#000" : T.muted, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{f}</button>)}
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>
      </>}>TASKS</SectionTitle>

      {data.tasks.length === 0 ? <EmptyState icon="✓" text="No tasks yet" action={<Btn onClick={() => setShowAdd(true)}>Add your first task</Btn>} /> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {Object.entries(byList).map(([list, tasks]) => (
            <div key={list}>
              <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 10 }}>{list.toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {tasks.map(task => {
                  const m = data.members.find(x => x.id === task.assignee);
                  const overdue = task.dueDate && !task.completed && task.dueDate < new Date().toISOString().split("T")[0];
                  return (
                    <div key={task.id} className="slide-in" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: T.card, borderRadius: 10, border: `1px solid ${overdue ? T.red + "44" : T.border}`, opacity: task.completed ? 0.6 : 1 }}>
                      <div className={`checkbox ${task.completed ? "checked" : ""}`} onClick={() => toggle(task.id)} style={{ marginTop: 2 }}>{task.completed && <span style={{ fontSize: 9, color: "#000" }}>✓</span>}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: task.completed ? "line-through" : "none", color: task.completed ? T.muted : T.text }}>{task.title}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {m && <MemberBadge member={m} />}
                          {task.dueDate && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: overdue ? `${T.red}20` : `${T.muted}20`, color: overdue ? T.red : T.muted }}>📅 {task.dueDate}</span>}
                        </div>
                      </div>
                      <button onClick={() => del(task.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16 }}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      }

      {showAdd && (
        <Modal title="Add Task" onClose={() => setShowAdd(false)} footer={<><Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn onClick={addTask} disabled={!newTask.title.trim()}>Add</Btn></>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>TASK</label><input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="What needs doing?" style={{ width: "100%" }} autoFocus onKeyDown={e => e.key === "Enter" && addTask()} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>LIST</label><input value={newTask.list} onChange={e => setNewTask(p => ({ ...p, list: e.target.value }))} placeholder="General" style={{ width: "100%" }} /></div>
              <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>DUE DATE</label><input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} style={{ width: "100%" }} /></div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 8 }}>ASSIGN TO</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button onClick={() => setNewTask(p => ({ ...p, assignee: "" }))} style={{ padding: "5px 10px", borderRadius: 999, border: `2px solid ${!newTask.assignee ? T.accent : T.border}`, background: !newTask.assignee ? `${T.accent}22` : "transparent", color: T.mutedBright, fontSize: 12 }}>Anyone</button>
                {data.members.map(m => <button key={m.id} onClick={() => setNewTask(p => ({ ...p, assignee: m.id }))} style={{ padding: "5px 10px", borderRadius: 999, border: `2px solid ${newTask.assignee === m.id ? m.color : T.border}`, background: newTask.assignee === m.id ? `${m.color}22` : "transparent", color: newTask.assignee === m.id ? m.color : T.mutedBright, fontSize: 12, fontWeight: 600 }}>{m.emoji} {m.name}</button>)}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function Events({ data, save }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEv, setNewEv] = useState({ title: "", date: "", time: "", description: "", members: [] });
  const todayStr = new Date().toISOString().split("T")[0];
  const sorted = [...data.events].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(e => e.date >= todayStr);
  const past = sorted.filter(e => e.date < todayStr).reverse().slice(0, 5);

  const addEvent = () => {
    if (!newEv.title.trim() || !newEv.date) return;
    save({ ...data, events: [...data.events, { id: uid(), ...newEv }] });
    setNewEv({ title: "", date: "", time: "", description: "", members: [] }); setShowAdd(false);
  };

  const EvCard = ({ ev }) => {
    const isToday = ev.date === todayStr;
    const d = new Date(ev.date + "T00:00:00");
    return (
      <div className="slide-in" style={{ display: "flex", gap: 14, padding: "12px 16px", background: T.card, border: `1px solid ${isToday ? T.purple : T.border}`, borderRadius: 12, opacity: ev.date < todayStr ? 0.6 : 1 }}>
        <div style={{ minWidth: 48, textAlign: "center", background: isToday ? `${T.purple}20` : T.surface, border: `1px solid ${isToday ? T.purple : T.border}`, borderRadius: 8, padding: "6px 0" }}>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.muted }}>{d.toLocaleDateString("en", { month: "short" }).toUpperCase()}</div>
          <div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: isToday ? T.purple : T.text }}>{d.getDate()}</div>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.muted }}>{d.toLocaleDateString("en", { weekday: "short" }).toUpperCase()}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{ev.title}</div>
          {ev.time && <div style={{ fontSize: 12, color: T.muted }}>⏰ {ev.time}</div>}
          {ev.description && <div style={{ fontSize: 12, color: T.mutedBright, marginTop: 3 }}>{ev.description}</div>}
          {ev.members?.length > 0 && <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>{ev.members.map(mid => { const m = data.members.find(x => x.id === mid); return m ? <MemberBadge key={mid} member={m} /> : null; })}</div>}
        </div>
        <button onClick={() => save({ ...data, events: data.events.filter(e => e.id !== ev.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, alignSelf: "flex-start" }}>×</button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      <SectionTitle sub="Events and appointments" action={<Btn onClick={() => setShowAdd(true)}>+ Add Event</Btn>}>EVENTS</SectionTitle>
      {upcoming.length === 0 && past.length === 0 ? <EmptyState icon="📅" text="No events yet" action={<Btn onClick={() => setShowAdd(true)}>Add your first event</Btn>} /> : <>
        {upcoming.length > 0 && <><div style={{ fontFamily: T.pixel, fontSize: 8, color: T.green, letterSpacing: 1, marginBottom: 12 }}>UPCOMING</div><div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>{upcoming.map(ev => <EvCard key={ev.id} ev={ev} />)}</div></>}
        {past.length > 0 && <><div style={{ fontFamily: T.pixel, fontSize: 8, color: T.muted, letterSpacing: 1, marginBottom: 12 }}>RECENT PAST</div><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{past.map(ev => <EvCard key={ev.id} ev={ev} />)}</div></>}
      </>}

      {showAdd && (
        <Modal title="Add Event" onClose={() => setShowAdd(false)} footer={<><Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn onClick={addEvent} disabled={!newEv.title || !newEv.date}>Add</Btn></>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>TITLE</label><input value={newEv.title} onChange={e => setNewEv(p => ({ ...p, title: e.target.value }))} style={{ width: "100%" }} autoFocus /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>DATE</label><input type="date" value={newEv.date} onChange={e => setNewEv(p => ({ ...p, date: e.target.value }))} style={{ width: "100%" }} /></div>
              <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>TIME</label><input type="time" value={newEv.time} onChange={e => setNewEv(p => ({ ...p, time: e.target.value }))} style={{ width: "100%" }} /></div>
            </div>
            <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>DESCRIPTION</label><textarea value={newEv.description} onChange={e => setNewEv(p => ({ ...p, description: e.target.value }))} style={{ width: "100%", minHeight: 64, resize: "vertical" }} /></div>
            <div>
              <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 8 }}>WHO'S INVOLVED</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {data.members.map(m => { const sel = newEv.members.includes(m.id); return <button key={m.id} onClick={() => setNewEv(p => ({ ...p, members: sel ? p.members.filter(x => x !== m.id) : [...p.members, m.id] }))} style={{ padding: "5px 10px", borderRadius: 999, border: `2px solid ${sel ? m.color : T.border}`, background: sel ? `${m.color}22` : "transparent", color: sel ? m.color : T.mutedBright, fontSize: 12, fontWeight: 600 }}>{m.emoji} {m.name}</button>; })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── GROCERY ──────────────────────────────────────────────────────────────────
const CATS = ["🥩 Meat & Fish", "🥬 Produce", "🧀 Dairy", "🥐 Bakery", "🧃 Beverages", "🧹 Cleaning", "🛁 Personal Care", "🥫 Pantry", "🧊 Frozen", "🛍 Other"];

function Grocery({ data, save }) {
  const [form, setForm] = useState({ name: "", quantity: "", category: "🛍 Other" });
  const [showChecked, setShowChecked] = useState(false);
  const inputRef = useRef();

  const add = () => {
    if (!form.name.trim()) return;
    save({ ...data, grocery: [...data.grocery, { id: uid(), ...form, checked: false }] });
    setForm(p => ({ ...p, name: "", quantity: "" }));
    inputRef.current?.focus();
  };

  const toggle = id => save({ ...data, grocery: data.grocery.map(g => g.id === id ? { ...g, checked: !g.checked } : g) });
  const remove = id => save({ ...data, grocery: data.grocery.filter(g => g.id !== id) });
  const clearChecked = () => save({ ...data, grocery: data.grocery.filter(g => !g.checked) });

  const unchecked = data.grocery.filter(g => !g.checked);
  const checked = data.grocery.filter(g => g.checked);
  const byCategory = CATS.reduce((acc, c) => { const items = unchecked.filter(g => (g.category || "🛍 Other") === c); if (items.length) acc[c] = items; return acc; }, {});

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      <SectionTitle sub={`${unchecked.length} items needed · ${checked.length} checked off`}>GROCERY LIST</SectionTitle>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={inputRef} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Add item..." style={{ flex: 1, minWidth: 140 }} onKeyDown={e => e.key === "Enter" && add()} />
          <input value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="Qty" style={{ width: 70 }} onKeyDown={e => e.key === "Enter" && add()} />
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ flex: 1, minWidth: 130 }}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
          <Btn onClick={add}>Add</Btn>
        </div>
      </Card>

      {unchecked.length === 0 && checked.length === 0 ? <EmptyState icon="🛒" text="Your list is empty!" /> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontFamily: T.pixel, fontSize: 7, color: T.accent, letterSpacing: 1, marginBottom: 8 }}>{cat.toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", background: T.card, borderRadius: 9, border: `1px solid ${T.border}` }}>
                    <div className="checkbox" onClick={() => toggle(item.id)} />
                    <span style={{ flex: 1, fontSize: 14 }}>{item.name}</span>
                    {item.quantity && <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{item.quantity}</span>}
                    <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      }

      {checked.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button onClick={() => setShowChecked(p => !p)} style={{ fontFamily: T.pixel, fontSize: 7, color: T.muted, background: "none", border: "none", letterSpacing: 1 }}>{showChecked ? "▼" : "▶"} CHECKED OFF ({checked.length})</button>
            {showChecked && <Btn size="sm" variant="danger" onClick={clearChecked}>Clear all</Btn>}
          </div>
          {showChecked && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {checked.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, opacity: 0.5 }}>
                  <div className="checkbox checked" onClick={() => toggle(item.id)}><span style={{ fontSize: 9, color: "#000" }}>✓</span></div>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: "line-through", color: T.muted }}>{item.name}</span>
                  <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PIXOO ────────────────────────────────────────────────────────────────────
function Pixoo({ data, save }) {
  const [ip, setIp] = useState(data.pixoo?.ip || "");
  const [brightness, setBrightness] = useState(data.pixoo?.brightness ?? 70);
  const [mode, setMode] = useState(data.pixoo?.displayMode || "duties");
  const [customText, setCustomText] = useState("");
  const [status, setStatus] = useState(null); // null | "ok" | "err"
  const [sending, setSending] = useState(false);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const cmd = async (payload) => {
    if (!ip) return false;
    try {
      const r = await fetch(`http://${ip}/post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(4000) });
      return r.ok;
    } catch { return false; }
  };

  const test = async () => {
    const ok = await cmd({ Command: "Channel/GetIndex" });
    setStatus(ok ? "ok" : "err");
    if (ok) save({ ...data, pixoo: { ...data.pixoo, ip } });
  };

  const week = getWeekKey();
  const todayStr = new Date().toISOString().split("T")[0];

  const previewLines = () => {
    if (mode === "duties") return data.duties.slice(0, 4).map(d => { const m = data.members.find(x => x.id === d.weeklyRotation?.[week]); return `${d.emoji} ${d.name}: ${m?.name || "---"}`; });
    if (mode === "events") { const ev = data.events.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0]; return ev ? [`📅 ${ev.title}`, `   ${ev.date}${ev.time ? " " + ev.time : ""}`] : ["No upcoming events"]; }
    if (mode === "grocery") { const items = data.grocery.filter(g => !g.checked); return items.length ? [`🛒 ${items.length} items`, ...items.slice(0, 2).map(i => `  • ${i.name}`)] : ["🛒 All bought!"]; }
    if (mode === "clock") return [time.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }), time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })];
    if (mode === "custom") return [customText || "(empty)"];
    return [];
  };

  const sendToPixoo = async () => {
    setSending(true);
    await cmd({ Command: "Draw/ClearHttpText" });
    const colors = ["#22d3ee", "#f97316", "#facc15", "#22c55e"];
    const lines = previewLines();
    for (let i = 0; i < lines.length; i++) {
      await cmd({ Command: "Draw/SendHttpText", TextId: i + 1, x: 0, y: i * 16, dir: 0, font: 2, TextWidth: 64, Textheight: 16, speed: 80, color: colors[i % 4], align: 1, TextString: lines[i] });
    }
    setSending(false);
  };

  const MODES = [
    { id: "duties", label: "Weekly Duties", icon: "🔄" },
    { id: "events", label: "Next Event", icon: "📅" },
    { id: "grocery", label: "Grocery Count", icon: "🛒" },
    { id: "clock", label: "Date & Clock", icon: "🕐" },
    { id: "custom", label: "Custom Text", icon: "✏️" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      <SectionTitle sub="Control your Divoom Pixoo64 LED display">PIXOO64</SectionTitle>

      <div style={{ background: `${T.yellow}12`, border: `1px solid ${T.yellow}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: T.mutedBright, lineHeight: 1.6 }}>
        ⚠️ <strong style={{ color: T.yellow }}>Home WiFi only</strong> — The Pixoo64 is a local device. Control works when your phone and the Pixoo are on the same home WiFi network.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <Card>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 16 }}>CONNECTION</div>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>DEVICE IP</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.42" style={{ flex: 1 }} />
            <Btn onClick={test} disabled={!ip}>Test</Btn>
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>Find in Divoom app → Device → IP address</p>
          {status && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 16, background: status === "ok" ? `${T.green}15` : `${T.red}15`, border: `1px solid ${status === "ok" ? T.green : T.red}44`, fontSize: 13, color: status === "ok" ? T.green : T.red }}>{status === "ok" ? "✓ Connected!" : "✗ Failed — check IP & WiFi"}</div>}
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>BRIGHTNESS <span style={{ color: T.accent }}>{brightness}%</span></label>
          <input type="range" min="0" max="100" value={brightness} onChange={e => setBrightness(+e.target.value)} onMouseUp={e => { cmd({ Command: "Channel/SetBrightness", Brightness: +e.target.value }); save({ ...data, pixoo: { ...data.pixoo, brightness: +e.target.value } }); }} style={{ width: "100%", accentColor: T.accent, marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" onClick={() => cmd({ Command: "Channel/OnOffScreen", OnOff: 1 })} style={{ flex: 1 }}>☀️ On</Btn>
            <Btn variant="secondary" onClick={() => cmd({ Command: "Channel/OnOffScreen", OnOff: 0 })} style={{ flex: 1 }}>🌙 Off</Btn>
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 14 }}>DISPLAY MODE</div>
          {MODES.map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); save({ ...data, pixoo: { ...data.pixoo, displayMode: m.id } }); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 9, border: `2px solid ${mode === m.id ? T.accent : T.border}`, background: mode === m.id ? `${T.accent}12` : T.surface, marginBottom: 7, cursor: "pointer" }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: mode === m.id ? T.accent : T.text }}>{m.label}</span>
              {mode === m.id && <span style={{ marginLeft: "auto", color: T.accent }}>✓</span>}
            </button>
          ))}
          {mode === "custom" && <input value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Your message…" style={{ width: "100%", marginBottom: 10 }} maxLength={64} />}
          <Btn onClick={sendToPixoo} disabled={sending || !ip} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>{sending ? "📡 Sending…" : "📺 Send to Pixoo64"}</Btn>
        </Card>
      </div>

      {/* Preview */}
      <Card style={{ marginTop: 20 }}>
        <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 14 }}>PREVIEW</div>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 192, height: 192, background: "#000", border: "4px solid #1a1a2e", borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0, boxShadow: `0 0 24px ${T.accent}33` }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: 10, gap: 6 }}>
              {previewLines().map((line, i) => (
                <div key={i} style={{ fontFamily: T.mono, fontSize: mode === "clock" && i === 1 ? 18 : 9, color: ["#22d3ee", "#f97316", "#facc15", "#22c55e"][i % 4], overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textAlign: mode === "clock" ? "center" : "left" }}>{line}</div>
              ))}
            </div>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)" }} />
          </div>
          <div>
            <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.muted, letterSpacing: 1, marginBottom: 10 }}>CONTENT</div>
            {previewLines().map((line, i) => <div key={i} style={{ fontFamily: T.mono, fontSize: 12, color: ["#22d3ee", "#f97316", "#facc15", "#22c55e"][i % 4], marginBottom: 4 }}>{line}</div>)}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ data, save }) {
  const [newM, setNewM] = useState({ name: "", emoji: "🧑", color: "#22d3ee" });
  const COLORS = ["#22d3ee", "#f97316", "#22c55e", "#a855f7", "#facc15", "#ef4444", "#ec4899", "#3b82f6"];

  const addMember = () => { if (!newM.name.trim()) return; save({ ...data, members: [...data.members, { id: uid(), ...newM }] }); setNewM({ name: "", emoji: "🧑", color: "#22d3ee" }); };
  const updateMember = (id, updates) => save({ ...data, members: data.members.map(m => m.id === id ? { ...m, ...updates } : m) });

  const exportData = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "household-hub-backup.json"; a.click(); };
  const importData = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { save(JSON.parse(ev.target.result)); } catch { alert("Invalid file"); } }; r.readAsText(f); };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      <SectionTitle sub="Manage household members and preferences">SETTINGS</SectionTitle>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 18 }}>HOUSEHOLD MEMBERS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {data.members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, flexWrap: "wrap" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${m.color}22`, border: `2px solid ${m.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{m.emoji}</div>
              <input value={m.emoji} onChange={e => updateMember(m.id, { emoji: e.target.value })} style={{ width: 48 }} />
              <input value={m.name} onChange={e => updateMember(m.id, { name: e.target.value })} style={{ flex: 1, minWidth: 100 }} />
              <div style={{ display: "flex", gap: 4 }}>{COLORS.map(c => <button key={c} onClick={() => updateMember(m.id, { color: c })} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: `2px solid ${m.color === c ? "#fff" : "transparent"}` }} />)}</div>
              <button onClick={() => { if (data.members.length > 1) save({ ...data, members: data.members.filter(x => x.id !== m.id) }); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 18 }} disabled={data.members.length <= 1}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={newM.emoji} onChange={e => setNewM(p => ({ ...p, emoji: e.target.value }))} style={{ width: 52 }} />
          <input value={newM.name} onChange={e => setNewM(p => ({ ...p, name: e.target.value }))} placeholder="Name" style={{ flex: 1, minWidth: 100 }} onKeyDown={e => e.key === "Enter" && addMember()} />
          <div style={{ display: "flex", gap: 4 }}>{COLORS.map(c => <button key={c} onClick={() => setNewM(p => ({ ...p, color: c }))} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: `2px solid ${newM.color === c ? "#fff" : "transparent"}` }} />)}</div>
          <Btn onClick={addMember} disabled={!newM.name.trim()}>+ Add Member</Btn>
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 18 }}>DATA</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[["Members", data.members.length], ["Duties", data.duties.length], ["Tasks", data.tasks.length], ["Events", data.events.length], ["Grocery", data.grocery.length]].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center", padding: "10px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 700, color: T.accent }}>{v}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{k}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={exportData}>⬇ Export</Btn>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⬆ Import<input type="file" accept=".json" onChange={importData} style={{ display: "none" }} /></label>
          <Btn variant="danger" onClick={() => { if (window.confirm("Reset ALL data?")) save(DEFAULT_DATA()); }}>🗑 Reset</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [syncStatus, setSyncStatus] = useState("saved");

  useEffect(() => {
    injectGlobals();
    (async () => {
      const loaded = await dbLoad();
      setData(loaded || DEFAULT_DATA());
    })();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel("household_data_changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "household_data", filter: `id=eq.${DB_KEY}` }, payload => {
        setData(payload.new.data);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const save = useCallback(async (newData) => {
    setData(newData);
    setSyncStatus("saving");
    await dbSave(newData);
    setSyncStatus("saved");
  }, []);

  if (!data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg, flexDirection: "column", gap: 20 }}>
      <div style={{ fontFamily: T.pixel, fontSize: 10, color: T.accent, letterSpacing: 4, animation: "pulse 2s infinite" }}>HOUSEHOLD HUB</div>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} syncStatus={syncStatus} />
      <main style={{ paddingBottom: 48 }}>
        {activeTab === "dashboard" && <Dashboard data={data} setActiveTab={setActiveTab} />}
        {activeTab === "duties" && <Duties data={data} save={save} />}
        {activeTab === "tasks" && <Tasks data={data} save={save} />}
        {activeTab === "events" && <Events data={data} save={save} />}
        {activeTab === "grocery" && <Grocery data={data} save={save} />}
        {activeTab === "pixoo" && <Pixoo data={data} save={save} />}
        {activeTab === "settings" && <Settings data={data} save={save} />}
      </main>
    </div>
  );
}
