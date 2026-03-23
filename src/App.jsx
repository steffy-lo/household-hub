import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#06080f", surface: "#0c1018", card: "#111827",
  border: "#1e2d42", borderBright: "#2a3f5f",
  accent: "#22d3ee", accentDim: "#0e7490",
  orange: "#f97316", green: "#22c55e", purple: "#a855f7",
  yellow: "#facc15", red: "#ef4444",
  text: "#e2e8f0", muted: "#64748b", mutedBright: "#94a3b8",
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
  const we = new Date(ws); we.setUTCDate(ws.getUTCDate() + 6);
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
      { id: "m1", name: "Alex", color: "#22d3ee" },
      { id: "m2", name: "Jordan", color: "#f97316" },
    ],
    duties: [
      { id: "d1", name: "Laundry", weeklyRotation: { [week]: "m1" } },
      { id: "d2", name: "Floor Cleaning", weeklyRotation: { [week]: "m2" } },
      { id: "d3", name: "Dishes", weeklyRotation: { [week]: "m1" } },
      { id: "d4", name: "Trash", weeklyRotation: { [week]: "m2" } },
      { id: "d5", name: "Bathroom", weeklyRotation: { [week]: "m1" } },
    ],
    tasks: [], events: [], grocery: [],
    pixoo: { ip: "", brightness: 70 },
  };
}

// ─── DATA LAYER ───────────────────────────────────────────────────────────────
async function dbLoad() {
  if (supabase) {
    const { data, error } = await supabase.from("household_data").select("data").eq("id", DB_KEY).single();
    if (!error && data) return data.data;
  }
  const raw = localStorage.getItem("hh_hub_v1");
  return raw ? JSON.parse(raw) : null;
}
async function dbSave(payload) {
  localStorage.setItem("hh_hub_v1", JSON.stringify(payload));
  if (supabase) await supabase.from("household_data").upsert({ id: DB_KEY, data: payload, updated_at: new Date().toISOString() });
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
      .slide-in{animation:slideIn .25s ease}
      .checkbox{width:18px;height:18px;border:2px solid ${T.border};border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;background:transparent}
      .checkbox.checked{background:${T.accent};border-color:${T.accent}}
      .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fadeIn .15s ease}
      .modal{background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:24px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;animation:slideIn .2s ease}
      @media(max-width:640px){.modal{padding:16px}.hide-mobile{display:none!important}}
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
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${member.color}22`, border: `1px solid ${member.color}44`, borderRadius: 999, padding: size === "sm" ? "4px 8px" : "5px 10px" }}>
      <div style={{ width: size === "sm" ? 8 : 10, height: size === "sm" ? 8 : 10, borderRadius: "50%", background: member.color, boxShadow: `0 0 0 2px ${member.color}22` }} />
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
function Header({ activeTab, setActiveTab, syncStatus }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <header style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 16, height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, background: `${T.accent}22`, border: `1px solid ${T.accentDim}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 16 }}>🏠</span></div>
          <div className="hide-mobile">
            <div style={{ fontFamily: T.pixel, fontSize: 7, color: T.accent, letterSpacing: 2 }}>HOUSEHOLD</div>
            <div style={{ fontFamily: T.pixel, fontSize: 7, color: T.mutedBright, letterSpacing: 1 }}>HUB</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 1, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, border: "none", background: activeTab === tab.id ? `${T.accent}20` : "transparent", color: activeTab === tab.id ? T.accent : T.muted, fontFamily: T.pixel, fontSize: 6, letterSpacing: 1, whiteSpace: "nowrap", borderBottom: activeTab === tab.id ? `2px solid ${T.accent}` : "2px solid transparent", flexShrink: 0 }}>
              <span style={{ fontSize: 12 }}>{tab.icon}</span>
              <span className="hide-mobile">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: `${syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red}15`, border: `1px solid ${syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red}44` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red, animation: syncStatus === "saving" ? "pulse 1s infinite" : "none" }} />
            <span style={{ fontFamily: T.mono, fontSize: 9, color: syncStatus === "saved" ? T.green : syncStatus === "saving" ? T.yellow : T.red }} className="hide-mobile">{syncStatus === "saved" ? "SYNCED" : syncStatus === "saving" ? "SAVING" : "OFFLINE"}</span>
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
      <div style={{ background: `linear-gradient(135deg, ${T.accentDim}30, ${T.purple}18)`, border: `1px solid ${T.borderBright}`, borderRadius: 16, padding: "18px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 2, marginBottom: 6 }}>WEEK {week.split("-W")[1]} · {getWeekLabel()}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{today.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</h1>
        </div>
        <span style={{ fontSize: 40 }}>🏠</span>
      </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card>
          <SectionTitle sub={getWeekLabel()} action={<Btn size="sm" variant="ghost" onClick={() => setActiveTab("duties")}>View →</Btn>}>THIS WEEK</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {duties.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <SpritePreview rows={getDutySpriteRows(d)} color={d.assignee?.color || T.accent} scale={2.5} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</span>
                </div>
                {d.assignee ? <MemberBadge member={d.assignee} /> : <span style={{ fontSize: 11, color: T.muted }}>Unassigned</span>}
              </div>
            ))}
          </div>
        </Card>
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
  const [newDuty, setNewDuty] = useState({ name: "" });
  const [editingSpriteDutyId, setEditingSpriteDutyId] = useState(null);
  const [spriteDraft, setSpriteDraft] = useState(() => spriteRowsToGrid(SPRITES.default));
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
    save({ ...data, duties: [...data.duties, { id: uid(), ...newDuty, spriteRows: getDefaultSpriteRows(newDuty.name), weeklyRotation: {} }] });
    setNewDuty({ name: "" }); setShowAdd(false);
  };
  const editingDuty = data.duties.find(d => d.id === editingSpriteDutyId) || null;
  const openSpriteEditor = (duty) => {
    setEditingSpriteDutyId(duty.id);
    setSpriteDraft(spriteRowsToGrid(getDutySpriteRows(duty)));
  };
  const toggleDraftPixel = (row, col) => {
    setSpriteDraft(prev => prev.map((cells, r) => r === row ? cells.map((on, c) => c === col ? !on : on) : cells));
  };
  const saveSprite = () => {
    if (!editingDuty) return;
    const spriteRows = gridToSpriteRows(spriteDraft);
    save({ ...data, duties: data.duties.map(d => d.id === editingDuty.id ? { ...d, spriteRows } : d) });
    setEditingSpriteDutyId(null);
  };
  const resetSprite = () => {
    if (!editingDuty) return;
    setSpriteDraft(spriteRowsToGrid(getDefaultSpriteRows(editingDuty.name)));
  };
  const clearSprite = () => setSpriteDraft(Array.from({ length: 8 }, () => Array(8).fill(false)));
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>
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
          const spriteRows = getDutySpriteRows(duty);
          return (
            <Card key={duty.id} glow={assignee?.color}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <SpritePreview rows={spriteRows} color={assignee?.color || T.accent} scale={4} />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{duty.name}</span>
                </div>
                <button onClick={() => save({ ...data, duties: data.duties.filter(d => d.id !== duty.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 18 }}>×</button>
              </div>
              {assignee ? <div style={{ marginBottom: 12 }}><MemberBadge member={assignee} size="lg" /></div> :
                <div style={{ padding: "8px 12px", background: `${T.red}10`, border: `1px dashed ${T.red}40`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.muted }}>⚠ Unassigned</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <SpritePreview rows={spriteRows} color={assignee?.color || T.accent} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Pixoo sprite</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>This 8×8 icon appears beside the duty on the Pixoo.</div>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => openSpriteEditor(duty)}>Edit Sprite</Btn>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.members.map(m => (
                  <button key={m.id} onClick={() => assign(duty.id, m.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: `2px solid ${m.id === assignedId ? m.color : T.border}`, background: m.id === assignedId ? `${m.color}22` : "transparent", color: m.id === assignedId ? m.color : T.mutedBright, fontSize: 12, fontWeight: 600 }}>{m.name}</button>
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
            <div><label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>NAME</label><input value={newDuty.name} onChange={e => setNewDuty(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Vacuuming" style={{ width: "100%" }} autoFocus onKeyDown={e => e.key === "Enter" && addDuty()} /></div>
          </div>
        </Modal>
      )}
      {editingDuty && (
        <Modal title={`Edit Sprite · ${editingDuty.name}`} onClose={() => setEditingSpriteDutyId(null)} footer={<><Btn variant="ghost" onClick={() => setEditingSpriteDutyId(null)}>Cancel</Btn><Btn onClick={saveSprite}>Save Sprite</Btn></>}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 20px)", gap: 4, padding: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
              {spriteDraft.flatMap((cells, row) => cells.map((on, col) => (
                <button
                  key={`${row}-${col}`}
                  onClick={() => toggleDraftPixel(row, col)}
                  style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "#0a0f17" }}
                />
              )))}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <SpritePreview rows={gridToSpriteRows(spriteDraft)} color={T.accent} scale={8} />
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
                  Draw the 8×8 icon that should appear beside this duty on the Pixoo dashboard.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn size="sm" variant="ghost" onClick={resetSprite}>Reset To Suggested</Btn>
                <Btn size="sm" variant="ghost" onClick={clearSprite}>Clear</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SpritePreview({ rows, color = T.accent, scale = 3 }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 8, 8);
    drawSpriteRows(ctx, rows, 0, 0, color);
  }, [rows, color]);
  return <canvas ref={ref} width={8} height={8} style={{ width: 8 * scale, height: 8 * scale, imageRendering: "pixelated", background: "#000", border: `1px solid ${T.border}`, borderRadius: 6, flexShrink: 0 }} />;
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
                {data.members.map(m => <button key={m.id} onClick={() => setNewTask(p => ({ ...p, assignee: m.id }))} style={{ padding: "5px 10px", borderRadius: 999, border: `2px solid ${newTask.assignee === m.id ? m.color : T.border}`, background: newTask.assignee === m.id ? `${m.color}22` : "transparent", color: newTask.assignee === m.id ? m.color : T.mutedBright, fontSize: 12, fontWeight: 600 }}>{m.name}</button>)}
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
                {data.members.map(m => { const sel = newEv.members.includes(m.id); return <button key={m.id} onClick={() => setNewEv(p => ({ ...p, members: sel ? p.members.filter(x => x !== m.id) : [...p.members, m.id] }))} style={{ padding: "5px 10px", borderRadius: 999, border: `2px solid ${sel ? m.color : T.border}`, background: sel ? `${m.color}22` : "transparent", color: sel ? m.color : T.mutedBright, fontSize: 12, fontWeight: 600 }}>{m.name}</button>; })}
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
    setForm(p => ({ ...p, name: "", quantity: "" })); inputRef.current?.focus();
  };
  const toggle = id => save({ ...data, grocery: data.grocery.map(g => g.id === id ? { ...g, checked: !g.checked } : g) });
  const remove = id => save({ ...data, grocery: data.grocery.filter(g => g.id !== id) });
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
            {showChecked && <Btn size="sm" variant="danger" onClick={() => save({ ...data, grocery: data.grocery.filter(g => !g.checked) })}>Clear all</Btn>}
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

// ─── PIXEL RENDERING ENGINE ───────────────────────────────────────────────────
const PW = 64, PH = 64;

const MINI_FONT = {
  "A": ["0110", "1001", "1111", "1001", "1001"],
  "B": ["1110", "1001", "1110", "1001", "1110"],
  "C": ["0111", "1000", "1000", "1000", "0111"],
  "D": ["1110", "1001", "1001", "1001", "1110"],
  "E": ["1111", "1000", "1110", "1000", "1111"],
  "F": ["1111", "1000", "1110", "1000", "1000"],
  "G": ["0111", "1000", "1011", "1001", "0111"],
  "H": ["1001", "1001", "1111", "1001", "1001"],
  "I": ["111", "010", "010", "010", "111"],
  "J": ["0011", "0001", "0001", "1001", "0110"],
  "K": ["1001", "1010", "1100", "1010", "1001"],
  "L": ["1000", "1000", "1000", "1000", "1111"],
  "M": ["10001", "11011", "10101", "10001", "10001"],
  "N": ["1001", "1101", "1011", "1001", "1001"],
  "O": ["0110", "1001", "1001", "1001", "0110"],
  "P": ["1110", "1001", "1110", "1000", "1000"],
  "Q": ["0110", "1001", "1001", "1011", "0111"],
  "R": ["1110", "1001", "1110", "1010", "1001"],
  "S": ["0111", "1000", "0110", "0001", "1110"],
  "T": ["11111", "00100", "00100", "00100", "00100"],
  "U": ["1001", "1001", "1001", "1001", "0110"],
  "V": ["10001", "10001", "01010", "01010", "00100"],
  "W": ["10001", "10001", "10101", "11011", "10001"],
  "X": ["1001", "1001", "0110", "1001", "1001"],
  "Y": ["1001", "1001", "0110", "0010", "0010"],
  "Z": ["1111", "0001", "0010", "0100", "1111"],
  "0": ["0110", "1001", "1001", "1001", "0110"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["1110", "0001", "0110", "1000", "1111"],
  "3": ["1110", "0001", "0110", "0001", "1110"],
  "4": ["1001", "1001", "1111", "0001", "0001"],
  "5": ["1111", "1000", "1110", "0001", "1110"],
  "6": ["0111", "1000", "1110", "1001", "0110"],
  "7": ["1111", "0001", "0010", "0100", "0100"],
  "8": ["0110", "1001", "0110", "1001", "0110"],
  "9": ["0110", "1001", "0111", "0001", "1110"],
  " ": ["00", "00", "00", "00", "00"],
  "-": ["000", "000", "111", "000", "000"],
  "+": ["000", "010", "111", "010", "000"],
  "/": ["0001", "0010", "0100", "1000", "0000"],
  ".": ["0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "1", "1"],
  ":": ["0", "1", "0", "1", "0"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["1110", "0001", "0110", "0000", "0100"],
  "&": ["0110", "1000", "0111", "1001", "0111"],
};

function getMiniGlyphPattern(ch) {
  return MINI_FONT[ch] || MINI_FONT["?"];
}
function miniTextWidth(str, spacing = 1) {
  const s = String(str);
  let width = 0;
  for (let i = 0; i < s.length; i++) {
    width += getMiniGlyphPattern(s[i])[0].length;
    if (i < s.length - 1) width += spacing;
  }
  return width;
}
function fitMiniText(str, maxW, spacing = 1) {
  const s = String(str);
  if (miniTextWidth(s, spacing) <= maxW) return s;
  let out = "";
  for (const ch of s) {
    const next = out + ch;
    if (miniTextWidth(next, spacing) > maxW) break;
    out = next;
  }
  return out;
}
function pxMiniText(ctx, str, x, y, color, maxW = PW, spacing = 1) {
  ctx.fillStyle = color;
  const s = fitMiniText(str, maxW, spacing);
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const pattern = getMiniGlyphPattern(s[i]);
    for (let row = 0; row < pattern.length; row++) {
      for (let col = 0; col < pattern[row].length; col++) {
        if (pattern[row][col] === "1") ctx.fillRect(cx + col, y + row, 1, 1);
      }
    }
    cx += pattern[0].length;
    if (i < s.length - 1) cx += spacing;
    if (cx - x >= maxW) break;
  }
}

const DETAIL_FONT = {
  "A": ["010", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["011", "100", "100", "100", "011"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "G": ["011", "100", "101", "101", "011"],
  "H": ["101", "101", "111", "101", "101"],
  "I": ["111", "010", "010", "010", "111"],
  "J": ["001", "001", "001", "101", "010"],
  "K": ["101", "101", "110", "101", "101"],
  "L": ["100", "100", "100", "100", "111"],
  "M": ["10001", "11011", "10101", "10001", "10001"],
  "N": ["1001", "1101", "1011", "1001", "1001"],
  "O": ["010", "101", "101", "101", "010"],
  "P": ["110", "101", "110", "100", "100"],
  "Q": ["010", "101", "101", "111", "011"],
  "R": ["110", "101", "110", "101", "101"],
  "S": ["011", "100", "010", "001", "110"],
  "T": ["111", "010", "010", "010", "010"],
  "U": ["101", "101", "101", "101", "111"],
  "V": ["101", "101", "101", "101", "010"],
  "W": ["10001", "10001", "10101", "11011", "10001"],
  "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"],
  "Z": ["111", "001", "010", "100", "111"],
  "a": ["000", "011", "001", "011", "011"],
  "b": ["100", "100", "110", "101", "110"],
  "c": ["000", "011", "100", "100", "011"],
  "d": ["001", "001", "011", "101", "011"],
  "e": ["000", "010", "111", "100", "011"],
  "f": ["001", "010", "111", "010", "010"],
  "g": ["000", "011", "101", "011", "001"],
  "h": ["100", "100", "110", "101", "101"],
  "i": ["010", "000", "010", "010", "010"],
  "j": ["001", "000", "001", "001", "010"],
  "k": ["100", "101", "110", "101", "101"],
  "l": ["010", "010", "010", "010", "001"],
  "m": ["00000", "11010", "10101", "10101", "10101"],
  "n": ["000", "110", "101", "101", "101"],
  "o": ["000", "010", "101", "101", "010"],
  "p": ["000", "110", "101", "110", "100"],
  "q": ["000", "011", "101", "011", "001"],
  "r": ["000", "101", "110", "100", "100"],
  "s": ["000", "011", "110", "001", "110"],
  "t": ["010", "111", "010", "010", "001"],
  "u": ["000", "101", "101", "101", "011"],
  "v": ["000", "101", "101", "101", "010"],
  "w": ["00000", "10001", "10101", "10101", "01010"],
  "x": ["000", "101", "010", "010", "101"],
  "y": ["000", "101", "111", "001", "110"],
  "z": ["000", "111", "001", "010", "111"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "110", "101", "010"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["010", "101", "010", "101", "010"],
  "9": ["010", "101", "011", "001", "110"],
  " ": ["00", "00", "00", "00", "00"],
  "-": ["000", "000", "111", "000", "000"],
  "/": ["001", "001", "010", "100", "100"],
  ".": ["0", "0", "0", "0", "1"],
  ",": ["0", "0", "0", "1", "1"],
  ":": ["0", "1", "0", "1", "0"],
  "+": ["000", "010", "111", "010", "000"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["110", "001", "010", "000", "010"],
};

function getDetailGlyphPattern(ch) {
  return DETAIL_FONT[ch] || DETAIL_FONT["?"];
}
function detailTextWidth(str, spacing = 1) {
  const s = String(str);
  let width = 0;
  for (let i = 0; i < s.length; i++) {
    width += getDetailGlyphPattern(s[i])[0].length;
    if (i < s.length - 1) width += spacing;
  }
  return width;
}
function fitDetailText(str, maxW, spacing = 1) {
  const s = String(str);
  if (detailTextWidth(s, spacing) <= maxW) return s;
  let out = "";
  for (const ch of s) {
    const next = out + ch;
    if (detailTextWidth(next, spacing) > maxW) break;
    out = next;
  }
  return out;
}
function pxDetailText(ctx, str, x, y, color, maxW = PW, spacing = 1) {
  ctx.fillStyle = color;
  const s = fitDetailText(str, maxW, spacing);
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const pattern = getDetailGlyphPattern(s[i]);
    for (let row = 0; row < pattern.length; row++) {
      for (let col = 0; col < pattern[row].length; col++) {
        if (pattern[row][col] === "1") ctx.fillRect(cx + col, y + row, 1, 1);
      }
    }
    cx += pattern[0].length;
    if (i < s.length - 1) cx += spacing;
    if (cx - x >= maxW) break;
  }
}

// 8×8 sprites — each entry is 8 bytes (one per row, MSB = leftmost pixel)
const SPRITES = {
  laundry: [0x00, 0x24, 0x7E, 0x42, 0x5A, 0x5A, 0x7E, 0x3C],
  cleaning: [0x0C, 0x12, 0x12, 0x0C, 0x08, 0x3E, 0x7F, 0x36],
  dishes: [0x00, 0x1C, 0x22, 0x49, 0x41, 0x22, 0x1C, 0x08],
  trash: [0x08, 0x1C, 0x3E, 0x2A, 0x2A, 0x3E, 0x3E, 0x00],
  bathroom: [0x00, 0x00, 0x7E, 0x42, 0x7E, 0x0C, 0x12, 0x0C],
  calendar: [0x24, 0x7E, 0x42, 0x7E, 0x42, 0x5A, 0x7E, 0x00],
  cart: [0x08, 0x1C, 0x14, 0x3E, 0x7F, 0x3E, 0x14, 0x00],
  check: [0x00, 0x01, 0x02, 0x24, 0x58, 0x30, 0x20, 0x00],
  house: [0x08, 0x1C, 0x3E, 0x7F, 0x49, 0x49, 0x7F, 0x00],
  default: [0x00, 0x18, 0x3C, 0x66, 0x42, 0x66, 0x3C, 0x18],
};

function getSpriteKey(name = "") {
  const n = name.toLowerCase();
  if (/laundry|wash/.test(n)) return "laundry";
  if (/floor|clean|sweep|mop|vacuum|broom/.test(n)) return "cleaning";
  if (/dish|plate|kitchen/.test(n)) return "dishes";
  if (/trash|bin|garbage|rubbish/.test(n)) return "trash";
  if (/bathroom|toilet|shower|bath/.test(n)) return "bathroom";
  if (/event|calendar|schedul|appoint/.test(n)) return "calendar";
  if (/grocery|shop|store|buy|cart/.test(n)) return "cart";
  if (/task|todo|check|done/.test(n)) return "check";
  if (/home|house/.test(n)) return "house";
  return "default";
}

function sanitizeSpriteRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 8) return null;
  const clean = rows.map(v => Number(v) & 0xff);
  return clean.every(v => Number.isFinite(v)) ? clean : null;
}

function getDefaultSpriteRows(name = "") {
  return [...(SPRITES[getSpriteKey(name)] || SPRITES.default)];
}

function getDutySpriteRows(duty) {
  return sanitizeSpriteRows(duty?.spriteRows) || getDefaultSpriteRows(duty?.name);
}

function spriteRowsToGrid(rows) {
  const safe = sanitizeSpriteRows(rows) || SPRITES.default;
  return safe.map(row => Array.from({ length: 8 }, (_, c) => Boolean(row & (1 << (7 - c)))));
}

function gridToSpriteRows(grid) {
  return grid.map(row => row.reduce((acc, on, c) => acc | (on ? (1 << (7 - c)) : 0), 0));
}

function drawSprite(ctx, key, x, y, color) {
  drawSpriteRows(ctx, SPRITES[key] || SPRITES.default, x, y, color);
}

function drawSpriteRows(ctx, rows, x, y, color) {
  const safeRows = sanitizeSpriteRows(rows) || SPRITES.default;
  ctx.fillStyle = color;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (safeRows[r] & (1 << (7 - c))) ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

function drawSoftCard(ctx, x, y, w, h, fill, border = "#2b3551") {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawKawaiiHeader(ctx, label, color, iconKey, accent = "#ffd7ec") {
  drawSoftCard(ctx, 0, 0, PW, 11, "#141a30", "#26304a");
  ctx.fillStyle = color;
  ctx.fillRect(0, 10, PW, 1);
  const hasIcon = Boolean(iconKey);
  if (hasIcon) drawSprite(ctx, iconKey, 2, 1, color);
  pxMiniText(ctx, String(label).toUpperCase(), hasIcon ? 12 : 4, 3, color, hasIcon ? 42 : 50);
}

function drawInfoRow(ctx, x, y, w, h, title, detail, accent, iconRows, fill = "#171d32", border = "#2d3756") {
  drawSoftCard(ctx, x, y, w, h, fill, border);
  const hasIcon = Boolean(iconRows);
  if (hasIcon) drawSpriteRows(ctx, iconRows, x + 3, y + 3, accent);
  const textX = hasIcon ? x + 14 : x + 4;
  const textW = hasIcon ? w - 22 : w - 8;
  pxDetailText(ctx, String(title), textX, y + 2, accent, textW);
  if (detail) pxDetailText(ctx, String(detail), textX, y + 7, "#dce6f7", textW);
}

function formatCompactDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

// ── Mode-specific renderers ───────────────────────────────────────────────────
function renderDuties(ctx, duties, members, week) {
  const COLORS = ["#ff68b3", "#7bd7ff", "#ffd76d", "#88f0b7"];
  const rows = duties.slice(0, 4);
  drawKawaiiHeader(ctx, "CHORES", "#ff87c2", null, "#ffd1eb");
  const rowH = 12;
  rows.forEach((duty, i) => {
    const y = 12 + i * rowH;
    const member = members.find(m => m.id === duty.weeklyRotation?.[week]);
    const color = member?.color || COLORS[i % 4];
    drawSoftCard(ctx, 1, y, 62, 11, "#171d32", "#2d3756");
    drawSpriteRows(ctx, getDutySpriteRows(duty), 3, y + 2, color);
    const dutyLabel = fitDetailText(duty.name, 44);
    pxDetailText(ctx, dutyLabel, 14, y + 2, color, 44);
    const memberLabel = fitDetailText(member ? member.name : "Unassigned", 40);
    pxDetailText(ctx, memberLabel, 14, y + 7, member ? "#d6ebff" : "#8891aa", 40);
  });
}

function renderEvents(ctx, events) {
  const todayStr = new Date().toISOString().split("T")[0];
  const upcoming = [...events].filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  drawKawaiiHeader(ctx, "EVENTS", "#9cb5ff", null, "#ffd4ef");
  if (!upcoming.length) {
    drawSoftCard(ctx, 10, 17, 44, 28, "#171d32", "#2d3756");
    drawSprite(ctx, "calendar", 28, 21, "#9cb5ff");
    pxMiniText(ctx, "NO PLANS", 18, 39, "#d8def0", 24);
    pxMiniText(ctx, "ALL CLEAR", 14, 47, "#7382a8", 32);
    return;
  }
  const rowH = 15;
  upcoming.forEach((ev, i) => {
    const y = 13 + i * rowH;
    const isToday = ev.date === todayStr;
    const color = isToday ? "#ff8bc7" : ["#9cb5ff", "#ffd56f", "#7be4d3"][i % 3];
    drawSoftCard(ctx, 2, y, 60, 13, "#171d32", "#2d3756");
    const d = new Date(ev.date + "T00:00:00");
    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
    pxDetailText(ctx, fitDetailText(ev.title, 52), 5, y + 7, color, 60);
    pxDetailText(ctx, dateStr, 5, y + 2, isToday ? "#ffd1eb" : "#8f9ab6", 60);
  });
}

function renderGrocery(ctx, grocery) {
  const items = grocery.filter(g => !g.checked);
  drawKawaiiHeader(ctx, "GROCERY", "#ffd56f", null, "#ffd7ec");
  if (items.length === 0) {
    drawSoftCard(ctx, 11, 18, 42, 26, "#182331", "#2c3551");
    drawSprite(ctx, "cart", 27, 21, "#ffd56f");
    pxMiniText(ctx, "ALL SET!", 19, 40, "#d9f7e7", 24);
    return;
  }
  const COLORS = ["#7be4d3", "#ffd56f", "#ff9dcc"];
  items.slice(0, 3).forEach((item, i) => {
    const y = 14 + i * 15;
    drawInfoRow(ctx, 2, y, 60, 13, fitDetailText(item.name, 48), item.quantity ? fitDetailText(String(item.quantity), 16) : "", COLORS[i % COLORS.length], null, "#151b2b", "#2d3756");
  });
  if (items.length > 3) pxMiniText(ctx, `+${items.length - 3} MORE`, 22, 60, "#7f8baa", 20);
}

function renderTasks(ctx, tasks, members) {
  const pending = tasks.filter(t => !t.completed);
  drawKawaiiHeader(ctx, "TO-DO", "#8af0a8", null, "#d6ffe3");
  if (pending.length === 0) {
    drawSoftCard(ctx, 11, 18, 42, 26, "#15252a", "#2c4a50");
    drawSprite(ctx, "check", 28, 21, "#8af0a8");
    pxMiniText(ctx, "DONE!", 24, 40, "#d8ffe2", 16);
    return;
  }
  pending.slice(0, 3).forEach((task, i) => {
    const y = 14 + i * 15;
    const assignee = members.find(m => m.id === task.assignee);
    const color = assignee?.color || ["#8af0a8", "#7be4d3", "#ffd56f"][i % 3];
    const detail = task.dueDate ? formatCompactDate(task.dueDate) : assignee?.name || "";
    drawInfoRow(ctx, 2, y, 60, 13, fitDetailText(task.title, 48), detail, color, null, "#15252a", "#2c4a50");
  });
  if (pending.length > 3) pxMiniText(ctx, `+${pending.length - 3} MORE`, 22, 58, "#7f9b89", 20);
}

function renderToCanvas(data, mode) {
  const canvas = document.createElement("canvas");
  canvas.width = PW; canvas.height = PH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, PW, PH);
  const week = getWeekKey();
  if (mode === "duties") renderDuties(ctx, data.duties, data.members, week);
  if (mode === "tasks") renderTasks(ctx, data.tasks, data.members);
  if (mode === "events") renderEvents(ctx, data.events);
  if (mode === "grocery") renderGrocery(ctx, data.grocery);
  return canvas;
}

// Pure manual base64 — no btoa/String.fromCharCode, no browser quirks
const B64CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function canvasToPixooBase64(canvas) {
  const pixels = canvas.getContext("2d").getImageData(0, 0, PW, PH).data;
  // Extract RGB bytes (drop alpha)
  const rgb = new Uint8Array(PW * PH * 3);
  for (let i = 0; i < PW * PH; i++) {
    rgb[i * 3] = pixels[i * 4];
    rgb[i * 3 + 1] = pixels[i * 4 + 1];
    rgb[i * 3 + 2] = pixels[i * 4 + 2];
  }
  // Encode 3 bytes → 4 base64 chars, no padding needed (12288 is divisible by 3)
  let out = "";
  for (let i = 0; i < rgb.length; i += 3) {
    const a = rgb[i], b = rgb[i + 1], c = rgb[i + 2];
    out += B64CHARS[a >> 2]
      + B64CHARS[((a & 3) << 4) | (b >> 4)]
      + B64CHARS[((b & 15) << 2) | (c >> 6)]
      + B64CHARS[c & 63];
  }
  return out;
}

// ─── PIXOO ────────────────────────────────────────────────────────────────────
const PIXOO_ROTATION_MODES = ["duties", "tasks", "events", "grocery"];

function Pixoo({ data, save }) {
  const [ip, setIp] = useState(data.pixoo?.ip || "");
  const [brightness, setBrightness] = useState(data.pixoo?.brightness ?? 70);
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendLog, setSendLog] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewRef = useRef();

  useEffect(() => {
    const t = setInterval(() => setPreviewIndex(i => (i + 1) % PIXOO_ROTATION_MODES.length), 3000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { drawPreview(); }, [previewIndex, data]);

  const drawPreview = () => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const src = renderToCanvas(data, PIXOO_ROTATION_MODES[previewIndex]);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    // Scale up 4× inside the canvas itself so text is readable in the UI
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, PW, PH, 0, 0, canvas.width, canvas.height);
  };

  const cmd = async (payload) => {
    if (!ip) return { ok: false, error: "No proxy URL set" };
    try {
      const url = ip.startsWith("http") ? `${ip.replace(/\/$/, "")}/post` : `http://${ip}/post`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
      const rawText = await r.text();
      let body = {};
      try { body = JSON.parse(rawText); } catch { }
      const ok = r.ok && (body.error_code === 0 || body.error_code === undefined);
      return { ok, status: r.status, body, rawText };
    } catch (e) { return { ok: false, error: e.message }; }
  };

  const test = async () => {
    const res = await cmd({ Command: "Channel/GetIndex" });
    setStatus(res.ok ? "ok" : "err");
    if (res.ok) save({ ...data, pixoo: { ...data.pixoo, ip } });
  };

  const getNextPicId = async (log) => {
    const current = await cmd({ Command: "Draw/GetHttpGifId" });
    if (!current.ok) {
      log.push({ label: "Load Pixoo frame ID", ok: false, detail: current.error || current.rawText || "Request failed" });
      setSendLog([...log]);
      return null;
    }
    const rawId = Number(current.body?.PicId ?? current.body?.PicID ?? 0);
    if (!Number.isFinite(rawId)) {
      log.push({ label: "Load Pixoo frame ID", ok: false, detail: `Unexpected response: ${current.rawText || JSON.stringify(current.body)}` });
      setSendLog([...log]);
      return null;
    }
    if (rawId >= 31) {
      const reset = await cmd({ Command: "Draw/ResetHttpGifId" });
      if (!reset.ok) {
        log.push({ label: "Reset Pixoo frame ID", ok: false, detail: reset.error || reset.rawText || "Request failed" });
        setSendLog([...log]);
        return null;
      }
      log.push({ label: "Reset Pixoo frame ID", ok: true, detail: `counter=${rawId} -> 1` });
      setSendLog([...log]);
      return 1;
    }
    const nextId = rawId + 1;
    log.push({ label: "Load Pixoo frame ID", ok: true, detail: `counter=${rawId} -> sending ${nextId}` });
    setSendLog([...log]);
    return nextId;
  };

  const sendToPixoo = async () => {
    setSending(true);
    setSendLog([]);
    const log = [];
    const step = async (label, payload) => {
      const res = await cmd(payload);
      const detail = res.error
        ? res.error
        : `error_code=${res.body?.error_code ?? "?"} · ${res.rawText?.slice(0, 100)}`;
      log.push({ label, ok: res.ok, detail });
      setSendLog([...log]);
      return res.ok;
    };

    // Step 1: build the rotating household animation
    const frames = PIXOO_ROTATION_MODES.map(frameMode => renderToCanvas(data, frameMode));
    const frameData = frames.map(canvasToPixooBase64);
    const picId = await getNextPicId(log);
    if (picId == null) {
      setSending(false);
      return;
    }

    // Each frame must be uploaded separately with the same PicID and increasing PicOffset.
    const expectedLen = PW * PH * 3 * 4 / 3;
    const badFrame = frameData.findIndex(b64 => b64.length !== expectedLen);
    if (badFrame !== -1) {
      log.push({ label: `Payload size error on frame ${badFrame + 1}`, ok: false, detail: `got ${frameData[badFrame].length} chars, expected ${expectedLen}` });
      setSendLog([...log]); setSending(false); return;
    }
    log.push({ label: `Payload verified: ${PIXOO_ROTATION_MODES.length} frames × ${expectedLen} chars`, ok: true, detail: "" });
    setSendLog([...log]);

    await step("Switch to Custom channel (SelectIndex: 3)", {
      Command: "Channel/SetIndex",
      SelectIndex: 3,
    });

    for (let i = 0; i < frameData.length; i++) {
      const ok = await step(`Upload frame ${i + 1}/${frameData.length} (Draw/SendHttpGif)`, {
        Command: "Draw/SendHttpGif",
        PicNum: PIXOO_ROTATION_MODES.length,
        PicWidth: 64,
        PicOffset: i,
        PicID: picId,
        PicSpeed: 3000,
        PicData: frameData[i],
      });
      if (!ok) {
        setSending(false);
        return;
      }
    }

    setSending(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      <SectionTitle sub="Control your Divoom Pixoo64 LED display">PIXOO64</SectionTitle>

      <div style={{ background: `${T.accent}08`, border: `1px solid ${T.accentDim}44`, borderRadius: 12, padding: "16px 18px", marginBottom: 20, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>How to connect</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { n: "1", text: "Install cloudflared on your home computer", sub: "Mac: brew install cloudflared  ·  Windows: winget install --id Cloudflare.cloudflared" },
            { n: "2", text: "Run the proxy from the project folder", sub: null },
            { n: "3", text: "Copy the https://….trycloudflare.com URL it prints", sub: null },
            { n: "4", text: "Paste it below as the Proxy URL and click Test", sub: null },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${T.accent}22`, border: `1px solid ${T.accentDim}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 10, color: T.accent, flexShrink: 0, marginTop: 1 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 13, color: T.text }}>{s.text}</div>
                {s.sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{s.sub}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: "8px 14px", background: T.surface, borderRadius: 8, fontFamily: T.mono, fontSize: 12, color: T.green }}>
          $ node pixoo-proxy.js 192.168.1.42
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 16 }}>CONNECTION</div>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>PROXY URL</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={ip} onChange={e => setIp(e.target.value)} placeholder="https://xxxx.trycloudflare.com" style={{ flex: 1 }} />
            <Btn onClick={test} disabled={!ip}>Test</Btn>
          </div>
          {status && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 14, background: status === "ok" ? `${T.green}15` : `${T.red}15`, border: `1px solid ${status === "ok" ? T.green : T.red}44`, fontSize: 13, color: status === "ok" ? T.green : T.red }}>{status === "ok" ? "✓ Connected!" : "✗ Failed — is the proxy running?"}</div>}
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6 }}>BRIGHTNESS <span style={{ color: T.accent }}>{brightness}%</span></label>
          <input type="range" min="0" max="100" value={brightness} onChange={e => setBrightness(+e.target.value)} onMouseUp={e => { cmd({ Command: "Channel/SetBrightness", Brightness: +e.target.value }); save({ ...data, pixoo: { ...data.pixoo, brightness: +e.target.value } }); }} style={{ width: "100%", accentColor: T.accent, marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" onClick={() => cmd({ Command: "Channel/OnOffScreen", OnOff: 1 })} style={{ flex: 1 }}>Screen On</Btn>
            <Btn variant="secondary" onClick={() => cmd({ Command: "Channel/OnOffScreen", OnOff: 0 })} style={{ flex: 1 }}>Screen Off</Btn>
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 14 }}>DISPLAY ROTATION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Weekly Duties", icon: "household" },
              { label: "Pending Tasks", icon: "check" },
              { label: "Upcoming Events", icon: "calendar" },
              { label: "Grocery List", icon: "cart" },
            ].map((item, i) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: `1px solid ${previewIndex === i ? T.accent : T.border}`, background: previewIndex === i ? `${T.accent}12` : T.surface }}>
                <SpriteIcon spriteKey={item.icon} color={previewIndex === i ? T.accent : T.muted} />
                <span style={{ fontSize: 13, fontWeight: 600, color: previewIndex === i ? T.accent : T.text }}>{item.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: previewIndex === i ? T.accent : T.muted }}>{previewIndex === i ? "LIVE" : "NEXT"}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7, marginBottom: 10 }}>
            The Pixoo animation rotates through all four household boards every 3 seconds.
          </div>
          <Btn onClick={sendToPixoo} disabled={sending || !ip} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            {sending ? "Sending..." : "Send to Pixoo64"}
          </Btn>
          {sendLog.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {sendLog.map((entry, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: T.mono, padding: "5px 8px", borderRadius: 6, background: entry.ok ? `${T.green}10` : `${T.red}10`, border: `1px solid ${entry.ok ? T.green : T.red}30` }}>
                  <div style={{ color: entry.ok ? T.green : T.red }}>{entry.ok ? "✓" : "✗"} {entry.label}</div>
                  {entry.detail && <div style={{ color: T.muted, marginTop: 2, wordBreak: "break-all" }}>{entry.detail}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 14 }}>LIVE PREVIEW</div>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <canvas ref={previewRef} width={256} height={256}
              style={{ width: 192, height: 192, imageRendering: "pixelated", border: "4px solid #1a1a2e", borderRadius: 8, background: "#000", boxShadow: `0 0 24px ${T.accent}33`, display: "block" }} />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 6, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)" }} />
          </div>
          <div style={{ fontSize: 12, color: T.muted, maxWidth: 280, lineHeight: 1.7, marginTop: 8 }}>
            <p>This is a pixel-accurate preview rendered with the same engine as the Pixoo64.</p>
            <p style={{ marginTop: 8 }}>The display is 64×64 pixels. Text uses the compact custom pixel font from this renderer, and sprites are 8×8 bitmaps drawn from duty defaults or your saved custom icons.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Small canvas rendering a single sprite for inline use
function SpriteIcon({ spriteKey, color }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 8, 8);
    drawSprite(ctx, spriteKey, 0, 0, color || T.accent);
  }, [spriteKey, color]);
  return <canvas ref={ref} width={8} height={8} style={{ width: 16, height: 16, imageRendering: "pixelated", flexShrink: 0 }} />;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ data, save }) {
  const [newM, setNewM] = useState({ name: "", color: "#22d3ee" });
  const COLORS = ["#22d3ee", "#f97316", "#22c55e", "#a855f7", "#facc15", "#ef4444", "#ec4899", "#3b82f6"];
  const addMember = () => { if (!newM.name.trim()) return; save({ ...data, members: [...data.members, { id: uid(), ...newM }] }); setNewM({ name: "", color: "#22d3ee" }); };
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
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: m.color, boxShadow: `0 0 0 3px ${m.color}22` }} />
              <input value={m.name} onChange={e => updateMember(m.id, { name: e.target.value })} style={{ flex: 1, minWidth: 100 }} />
              <div style={{ display: "flex", gap: 4 }}>{COLORS.map(c => <button key={c} onClick={() => updateMember(m.id, { color: c })} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: `2px solid ${m.color === c ? "#fff" : "transparent"}` }} />)}</div>
              <button onClick={() => { if (data.members.length > 1) save({ ...data, members: data.members.filter(x => x.id !== m.id) }); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 18 }} disabled={data.members.length <= 1}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={newM.name} onChange={e => setNewM(p => ({ ...p, name: e.target.value }))} placeholder="Name" style={{ flex: 1, minWidth: 100 }} onKeyDown={e => e.key === "Enter" && addMember()} />
          <div style={{ display: "flex", gap: 4 }}>{COLORS.map(c => <button key={c} onClick={() => setNewM(p => ({ ...p, color: c }))} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: `2px solid ${newM.color === c ? "#fff" : "transparent"}` }} />)}</div>
          <Btn onClick={addMember} disabled={!newM.name.trim()}>+ Add Member</Btn>
        </div>
      </Card>
      <Card>
        <div style={{ fontFamily: T.pixel, fontSize: 8, color: T.accent, letterSpacing: 1, marginBottom: 18 }}>DATA</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[["Members", data.members.length], ["Duties", data.duties.length], ["Tasks", data.tasks.length], ["Events", data.events.length], ["Grocery", data.grocery.length]].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center", padding: 10, background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 700, color: T.accent }}>{v}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{k}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={exportData}>Export Backup</Btn>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Import Backup<input type="file" accept=".json" onChange={importData} style={{ display: "none" }} /></label>
          <Btn variant="danger" onClick={() => { if (window.confirm("Reset ALL data?")) save(DEFAULT_DATA()); }}>Reset All</Btn>
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
    (async () => { setData(await dbLoad() || DEFAULT_DATA()); })();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("hh_data")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "household_data", filter: `id=eq.${DB_KEY}` }, p => setData(p.new.data))
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
