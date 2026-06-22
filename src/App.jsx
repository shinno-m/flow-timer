import { useState, useEffect, useRef } from "react";

const WORK_MIN = 25;
const BREAK_MIN = 5;
const REVIVE_MS = 2500;
const STORAGE_KEY = "flow.v1";

const C = {
  bg: "#000000",
  card: "#1c1c1e",
  card2: "#2c2c2e",
  line: "#38383a",
  text: "#ffffff",
  sub: "#8e8e93",
  accent: "#7fae8e",
  accentDeep: "#9ec7ab",
  star: "#ffd23f",
  done: "#5a5a5e",
};
const FONT = "-apple-system,'SF Pro Display','SF Pro Text','Helvetica Neue',system-ui,sans-serif";

// --- localStorage persistence -------------------------------------------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
const saved = loadState();

export default function App() {
  const [raw, setRaw] = useState("");
  const [tasks, setTasks] = useState(saved?.tasks ?? []);
  const [activeId, setActiveId] = useState(saved?.activeId ?? null);
  const [phase, setPhase] = useState(saved?.phase ?? "idle");
  const [secondsLeft, setSecondsLeft] = useState(saved?.secondsLeft ?? WORK_MIN * 60);
  // The ticking timer is never auto-resumed after a reload — the user taps 再開.
  // This avoids the clock silently "catching up" on time the app was closed.
  const [running, setRunning] = useState(false);
  const [addText, setAddText] = useState("");
  // Free-text memo for on-hold / follow-up items. Shared across both screens
  // and persisted, so pending notes survive reloads until promoted to a task.
  const [memo, setMemo] = useState(saved?.memo ?? "");
  const [revivingId, setRevivingId] = useState(null);
  const tickRef = useRef(null);
  const reviveTimer = useRef(null);

  // Persist the meaningful state on every change so a reload restores it.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tasks, activeId, phase, secondsLeft, memo })
      );
    } catch (e) {}
  }, [tasks, activeId, phase, secondsLeft, memo]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(tickRef.current); handlePhaseEnd(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line
  }, [running]);

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.start(); o.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  }
  function handlePhaseEnd() {
    beep(); setRunning(false);
    if (phase === "work") { setPhase("break"); setSecondsLeft(BREAK_MIN * 60); setRunning(true); }
    else if (phase === "break") { setPhase("breakDone"); }
  }
  function sortByStar(list) { return [...list].sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0)); }
  function makeList() {
    const items = raw.split("\n").map((t) => t.trim()).filter(Boolean)
      .map((text, i) => ({ id: Date.now() + i, text, done: false, doneAt: null, star: false, startedAt: null, mins: null }));
    setTasks(items); setRaw(""); setActiveId(null); setPhase("idle");
  }
  function addTask() {
    const text = addText.trim(); if (!text) return;
    setTasks((ts) => sortByStar([...ts, { id: Date.now(), text, done: false, doneAt: null, star: false, startedAt: null, mins: null }]));
    setAddText("");
  }
  function toggleStar(id) { setTasks((ts) => sortByStar(ts.map((t) => (t.id === id ? { ...t, star: !t.star } : t)))); }
  function startTask(id) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, startedAt: Date.now() } : t)));
    setActiveId(id); setPhase("work"); setSecondsLeft(WORK_MIN * 60); setRunning(true);
  }
  function toggleRun() { setRunning((r) => !r); }
  function nextTask() {
    const next = tasks.find((t) => !t.done && t.id !== activeId);
    if (next) startTask(next.id);
    else { setActiveId(null); setPhase("idle"); setRunning(false); setSecondsLeft(WORK_MIN * 60); }
  }
  function completeTask(id) {
    const now = new Date();
    const stamp = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    setTasks((ts) => ts.map((t) => {
      if (t.id !== id) return t;
      const segment = t.startedAt ? Math.max(1, Math.round((now.getTime() - t.startedAt) / 60000)) : 0;
      const prior = t.mins || 0;
      const totalMins = prior + segment > 0 ? prior + segment : null;
      return { ...t, done: true, doneAt: stamp, mins: totalMins, startedAt: null };
    }));
    // Clearing activeId returns the screen to the idle state so the stale
    // timer ring doesn't linger after the active task is completed.
    if (id === activeId) { setActiveId(null); setRunning(false); setPhase("idle"); setSecondsLeft(WORK_MIN * 60); }
  }
  function reviveTask(id) {
    setTasks((ts) => sortByStar(ts.map((t) => (t.id === id ? { ...t, done: false, doneAt: null, startedAt: null } : t))));
  }
  function pressStart(id) {
    setRevivingId(id);
    reviveTimer.current = setTimeout(() => { reviveTask(id); setRevivingId(null); }, REVIVE_MS);
  }
  function pressEnd() { clearTimeout(reviveTimer.current); setRevivingId(null); }

  function resetAll() {
    setTasks([]); setActiveId(null); setPhase("idle");
    setRunning(false); setSecondsLeft(WORK_MIN * 60);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const activeTask = tasks.find((t) => t.id === activeId);
  const openTasks = tasks.filter((t) => !t.done);
  const doneLog = tasks.filter((t) => t.done);
  const remaining = openTasks.length;
  const isBreak = phase === "break" || phase === "breakDone";
  const total = (isBreak ? BREAK_MIN : WORK_MIN) * 60;
  const progress = activeTask ? 1 - secondsLeft / total : 0;
  const ringColor = isBreak ? C.sub : C.accent;

  const R = 248, STROKE = 8, RAD = (R - STROKE) / 2, CIRC = 2 * Math.PI * RAD;

  // One-handed layout: leave room at the bottom for the fixed control bar (when
  // a task is active) plus the iPhone home-indicator safe area.
  const containerPadBottom = activeTask
    ? "calc(env(safe-area-inset-bottom, 0px) + 128px)"
    : "calc(env(safe-area-inset-bottom, 0px) + 36px)";

  // Shared memo field, rendered on both the start screen and the task screen.
  const memoBlock = (
    <div style={{ margin: "28px 0 22px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, color: C.sub, margin: "0 6px 8px" }}>
        メモ
      </div>
      <textarea className="ipt" value={memo} onChange={(e) => setMemo(e.target.value)}
        placeholder={"保留中・フォロー中のメモ\n進展したらタスクに追加"}
        rows={4}
        style={{ width: "100%", padding: 16, borderRadius: 16, border: `1px solid ${C.line}`,
          fontSize: 16, fontFamily: FONT, resize: "vertical", boxSizing: "border-box",
          color: C.text, background: C.card, lineHeight: 1.8 }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: FONT }}>
      <style>{`
        * { transition: background-color .25s ease, color .25s ease, border-color .25s ease, transform .1s ease, opacity .2s ease; -webkit-tap-highlight-color: transparent; }
        button:active { transform: scale(0.96); }
        .ringfill { transition: stroke-dashoffset 1s linear; }
        .star-btn { background:none;border:none;cursor:pointer;padding:2px;font-size:18px;line-height:1; }
        input::placeholder, textarea::placeholder { color:#48484a; }
        .ipt:focus { outline:none; }
        @keyframes riseUp { to { transform: translateY(-6px) scale(1.02); box-shadow: 0 8px 24px rgba(127,174,142,0.35); } }
        .reviving { animation: riseUp ${REVIVE_MS}ms ease forwards; }
        .revivebar { transition: width ${REVIVE_MS}ms linear; }
        @keyframes glow { 0%,100% { opacity:.5 } 50% { opacity:1 } }
      `}</style>

      <div style={{ maxWidth: 430, margin: "0 auto",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 30px)",
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 20px)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 20px)",
        paddingBottom: containerPadBottom }}>

        {tasks.length === 0 ? (
          <section>
            {/* hero */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: C.accent,
                  display: "grid", placeItems: "center", boxShadow: "0 2px 10px rgba(127,174,142,0.4)" }}>
                  <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2.5px solid #000" }} />
                </span>
                <h1 style={{ fontSize: 30, margin: 0, fontWeight: 700, letterSpacing: 0.3 }}>Flow</h1>
              </div>
              <p style={{ color: C.sub, fontSize: 14.5, lineHeight: 1.7, margin: "14px 2px 0", fontWeight: 400 }}>
                25分集中 + 5分休憩のポモドーロタイマー。<br />
                タスクを改行で追加して1日のセットを作成。
              </p>
            </div>

            <textarea className="ipt" value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder={"例）\n資料レビュー\nメール返信\n見積もり確認"}
              rows={6}
              style={{ width: "100%", padding: 18, borderRadius: 16, border: `1px solid ${C.line}`,
                fontSize: 16, fontFamily: FONT, resize: "vertical", boxSizing: "border-box",
                color: C.text, background: C.card, lineHeight: 1.9 }} />
            <button onClick={makeList} disabled={!raw.trim()} style={primaryBtn(!raw.trim())}>はじめる</button>
            {memoBlock}
          </section>
        ) : (
          <>
            <h1 style={{ fontSize: 30, margin: "8px 4px 14px", fontWeight: 700, letterSpacing: 0.3 }}>Flow</h1>
            <section style={{ textAlign: "center", marginBottom: 26 }}>
              {activeTask ? (
                <div style={{ position: "relative", width: R, height: R, margin: "8px auto 0" }}>
                  <svg width={R} height={R} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={R/2} cy={R/2} r={RAD} fill="none" stroke={C.card2} strokeWidth={STROKE} />
                    <circle className="ringfill" cx={R/2} cy={R/2} r={RAD} fill="none" stroke={ringColor}
                      strokeWidth={STROKE} strokeLinecap="round"
                      strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 13, letterSpacing: 1, fontWeight: 600,
                      color: isBreak ? C.sub : C.accentDeep, marginBottom: 4 }}>
                      {phase === "work" ? "集中 25分" : phase === "break" ? "休憩 5分" : "休憩おわり"}
                    </div>
                    <div style={{ fontSize: 64, fontWeight: 200, fontVariantNumeric: "tabular-nums",
                      letterSpacing: -1.5, lineHeight: 1 }}>{mm}:{ss}</div>
                    <div style={{ fontSize: 14, color: C.sub, marginTop: 8, maxWidth: 170,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activeTask.text}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: C.sub, fontSize: 16, padding: "18px 0 6px", fontWeight: 300, letterSpacing: 0.5 }}>
                  今日のリズムを始めましょう
                </div>
              )}
            </section>

            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, color: C.sub,
              margin: "0 6px 8px", display: "flex", justifyContent: "space-between" }}>
              <span>タスク</span><span>残り {remaining}</span>
            </div>
            <section style={{ background: C.card, borderRadius: 16, overflow: "hidden", marginBottom: 22 }}>
              {openTasks.length === 0 && (
                <div style={{ padding: "16px", fontSize: 15, color: C.sub, textAlign: "center" }}>すべて完了しました</div>
              )}
              {openTasks.map((t, i) => {
                const isActive = t.id === activeId;
                return (
                  <div key={t.id}
                    onClick={!isActive ? () => startTask(t.id) : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 11,
                    padding: "15px 16px", borderTop: i === 0 ? "none" : `0.5px solid ${C.line}`,
                    cursor: !isActive ? "pointer" : "default" }}>
                    <button className="star-btn" onClick={(e) => { e.stopPropagation(); toggleStar(t.id); }}
                      style={{ color: t.star ? C.star : "#48484a" }}>{t.star ? "★" : "☆"}</button>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      display: "grid", placeItems: "center", background: "transparent",
                      border: `1.5px solid ${isActive ? C.accent : "#48484a"}` }}></span>
                    <span style={{ flex: 1, fontSize: 16, color: C.text, fontWeight: isActive ? 600 : 400 }}>{t.text}</span>
                    {isActive ? (
                      <span style={{ fontSize: 11, color: C.accent, fontWeight: 700, letterSpacing: 1 }}>NOW</span>
                    ) : (
                      <span style={{ fontSize: 20, color: "#48484a", lineHeight: 1 }}>›</span>
                    )}
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                borderTop: openTasks.length ? `0.5px solid ${C.line}` : "none" }}>
                <span style={{ color: C.accent, fontSize: 20, lineHeight: 1, width: 18, textAlign: "center" }}>+</span>
                <input className="ipt" value={addText} onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                  placeholder="タスクを追加"
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: FONT, color: C.text }} />
                {addText.trim() && (<button onClick={addTask} style={startLink}>追加</button>)}
              </div>
            </section>

            {doneLog.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, color: C.sub,
                  margin: "0 6px 8px", display: "flex", justifyContent: "space-between" }}>
                  <span>完了</span>
                  <span style={{ fontWeight: 400, color: "#5a5a5e" }}>長押しで戻す</span>
                </div>
                <section style={{ background: C.card, borderRadius: 16, overflow: "hidden", marginBottom: 22 }}>
                  {doneLog.map((t, i) => {
                    const isReviving = revivingId === t.id;
                    return (
                      <div key={t.id} className={isReviving ? "reviving" : ""}
                        onMouseDown={() => pressStart(t.id)} onMouseUp={pressEnd} onMouseLeave={pressEnd}
                        onTouchStart={() => pressStart(t.id)} onTouchEnd={pressEnd}
                        style={{ position: "relative", display: "flex", justifyContent: "space-between",
                          alignItems: "center", padding: "14px 16px", fontSize: 15, color: C.sub,
                          borderTop: i === 0 ? "none" : `0.5px solid ${C.line}`,
                          cursor: "pointer", userSelect: "none", background: C.card, borderRadius: isReviving ? 12 : 0 }}>
                        <span style={{ textDecoration: "line-through" }}>{t.text}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, flexShrink: 0, marginLeft: 12 }}>
                          {t.doneAt}{t.mins != null ? `（${t.mins}分）` : ""}
                        </span>
                        {isReviving && (
                          <div className="revivebar" style={{ position: "absolute", left: 0, bottom: 0, height: 2,
                            background: C.accent, width: "100%", transformOrigin: "left" }} />
                        )}
                      </div>
                    );
                  })}
                </section>
              </>
            )}

            {memoBlock}

            <button onClick={resetAll} style={resetBtn}>リセット</button>
          </>
        )}
      </div>

      {/* One-handed fixed control bar — keeps the primary actions in thumb reach. */}
      {activeTask && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20,
          display: "flex", gap: 16, justifyContent: "center",
          padding: "12px 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)", borderTop: `0.5px solid ${C.line}` }}>
          {phase === "breakDone" ? (
            <button onClick={nextTask} style={roundBtn(C.accent, "#fff")}>次へ</button>
          ) : (
            <button onClick={toggleRun} style={roundBtn(C.card2, running ? C.text : C.accent)}>
              {running ? "停止" : "再開"}
            </button>
          )}
          <button onClick={() => completeTask(activeTask.id)} style={roundBtn(C.card2, C.text)}>完了</button>
        </div>
      )}
    </div>
  );
}

function primaryBtn(d) {
  return { width: "100%", marginTop: 16, padding: "16px", borderRadius: 14, fontSize: 17, fontWeight: 600,
    cursor: d ? "default" : "pointer", background: d ? "#2c2c2e" : C.accent, color: d ? C.sub : "#fff",
    border: "none", fontFamily: FONT };
}
function roundBtn(bg, color) {
  return { width: 76, height: 76, borderRadius: "50%", fontSize: 15, fontWeight: 600, cursor: "pointer",
    background: bg, color, border: "none", fontFamily: FONT };
}
const startLink = { padding: "4px 8px", fontSize: 15, fontWeight: 500, cursor: "pointer",
  background: "transparent", border: "none", color: "#7fae8e", fontFamily: FONT };
const resetBtn = { display: "block", margin: "0 auto", padding: "10px 0", fontSize: 15, cursor: "pointer",
  background: "transparent", border: "none", color: C.sub, fontFamily: FONT };
