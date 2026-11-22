// Scraper für FVBJ-Matchcenter: Junioren B Promotion, Youth League B, EQUIP.Lab Berner Cup (Jun. B), Cup BCJ (Jun. B)
// Läuft im Browser auf https://matchcenter.fvbj-afbj.ch (gleicher Ursprung). Ergebnis in window.__S.result, Fortschritt in window.__S.status.
window.__S = {status: "start", log: []};
(async () => {
  const S = window.__S;
  const SEASON = "2027";
  const BASE = `/default.aspx?oid=6&lng=1&s=${SEASON}`;
  const t = s => (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const P = h => new DOMParser().parseFromString(h, "text/html");
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const get = async u => {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(u);
      if (r.status === 200) { const h = await r.text(); if (!/<title>Just a moment/i.test(h)) return P(h); }
      await sleep(4000 * (i + 1));
    }
    throw new Error("blockiert: " + u);
  };
  const strip = n => n.replace(/\s*\((Jun\.\s?B[^)]*|YL B)\)$/, "").trim();
  const tag = n => (n.match(/\((Jun\.\s?B[^)]*|YL B)\)$/) || [])[1] || "";

  async function groupsOf(ln) {
    const d = await get(`${BASE}&ln=${ln}`);
    const gs = new Map();
    const scan = doc => [...doc.querySelectorAll("a")].forEach(a => {
      const h = a.getAttribute("href") || "";
      const m = h.match(/ln=(\d+)&ls=(\d+)&sg=(\d+)&a=mrr/);
      if (m && m[1] === ln && m[3] !== "0" && !gs.has(m[2] + "-" + m[3])) gs.set(m[2] + "-" + m[3], {ls: m[2], sg: m[3], name: t(a.textContent)});
    });
    scan(d);
    const lss = [...new Set([...d.querySelectorAll("a")].map(a => ((a.getAttribute("href") || "").match(new RegExp(`ln=${ln}&ls=(\\d+)&sg=0`)) || [])[1]).filter(Boolean))];
    for (const ls of lss) { scan(await get(`${BASE}&ln=${ln}&ls=${ls}&sg=0&a=mgr`)); await sleep(300); }
    return [...gs.values()];
  }

  function listGames(d, extra) {
    const out = []; const links = [...d.querySelectorAll('a[href*="tg="]')]; if (!links.length) return out;
    const cnt = new Map(); links.forEach(a => cnt.set(a.parentElement, (cnt.get(a.parentElement) || 0) + 1));
    const list = [...cnt.entries()].sort((x, y) => y[1] - x[1])[0][0];
    let date = null;
    for (const el of list.children) {
      if (el.tagName !== "A") { const x = t(el.textContent); if (/\d\d\.\d\d\.\d{4}/.test(x)) date = x.match(/\d\d\.\d\d\.\d{4}/)[0]; continue; }
      const href = el.getAttribute("href") || ""; const m = href.match(/tg=(\d+)/); if (!m) continue;
      let home, away, gh, ga, time;
      if (el.querySelector(".teamA")) {
        home = t(el.querySelector(".teamA").textContent); away = t(el.querySelector(".teamB").textContent);
        gh = t(el.querySelector(".torA")?.textContent); ga = t(el.querySelector(".torB")?.textContent); time = t(el.querySelector(".time")?.textContent);
      } else {
        const cols = [...el.querySelectorAll(".col-sm-9 .col-sm-5")].map(c => t(c.textContent));
        const gl = [...el.querySelectorAll(".goals .col-sm-5")].map(c => t(c.textContent));
        home = cols[0] || ""; away = cols[1] || ""; gh = gl[0] || ""; ga = gl[1] || ""; time = t(el.querySelector(".col-sm-1")?.textContent);
      }
      out.push({tg: m[1], date, time, hl: home, al: away, home: strip(home), away: strip(away), gh: gh === "" ? null : +gh, ga: ga === "" ? null : +ga,
        forfait: /\bF\b|Forfait/.test(t(el.querySelector(".goals, .spielInfo")?.textContent) + " " + t(el.textContent).slice(-30)), ...extra});
    }
    return out;
  }

  function table(d) {
    return [...d.querySelectorAll("tr")].filter(tr => tr.querySelector(".ranCteam")).map(tr => {
      const c = k => t(tr.querySelector(".ranC" + k)?.textContent);
      return {rank: parseInt(c("rang")), team: c("team"), sp: +c("sp"), s: +c("s"), u: +c("u"), n: +c("n"), strp: +(c("strp").replace(/[()]/g, "") || 0), gf: +c("tg"), ga: +c("te"), pts: +c("pt")};
    });
  }

  function telegram(d) {
    const o = {};
    const head = t(d.querySelector(".shortSpielort")?.textContent).split(" - ");
    const i = head.findIndex(x => /Spielnummer/.test(x));
    o.nr = (head[i] || "").replace(/\D/g, ""); o.venue = head.slice(i + 1).join(" - ");
    o.ht = t(d.querySelector('[id$="divToreHz"]')?.textContent).replace(/[()]/g, "");
    o.extra = t(d.querySelector(".telegrammHeaderResultsDiv")?.textContent);
    o.logoH = (d.querySelector(".shortTeamFlagHeim img")?.getAttribute("src") || "").match(/(\d+)\.\w+$/)?.[1] || "";
    o.logoA = (d.querySelector(".shortTeamFlagGast img")?.getAttribute("src") || "").match(/(\d+)\.\w+$/)?.[1] || "";
    const pm = o.extra.match(/^(\d+)\s*:\s*(\d+)\s*nE\s*\((\d+)\s*:\s*(\d+)\)/);
    if (pm) { o.reg = [+pm[3], +pm[4]]; o.pens = `${pm[1] - pm[3]}:${pm[2] - pm[4]}`; }
    const lu = [...d.querySelectorAll('[id$="sfvTelegrammBody_phAufstellung"] > .col-sm-6')].map(col => new Set([...col.querySelectorAll(".aufName")].map(n => t([...n.childNodes].filter(c => !(c.classList && c.classList.contains("aufCaptain"))).map(c => c.textContent).join("")))));
    // Aufstellungen: Startelf (mit Position, Captain), Ersatzbank (Sternchen = kein Einsatz), Trainer
    o.lineup = [...d.querySelectorAll('[id$="sfvTelegrammBody_phAufstellung"] > .col-sm-6')].map(col => {
      const L = {start: [], bench: [], staff: []}; let sec = "start";
      const tb = [...col.querySelectorAll("table")].find(x => x.querySelector(".aufName"));
      if (!tb) return L;
      for (const tr of tb.querySelectorAll("tr")) {
        const ti = tr.querySelector(".aufTitel");
        if (ti) { const x = t(ti.textContent); sec = /Ersatz/i.test(x) ? "bench" : /Trainer/i.test(x) ? "staff" : "skip"; continue; }
        const nEl = tr.querySelector(".aufName"); if (!nEl || sec === "skip") continue;
        const raw = t(nEl.textContent); const cap = /\(C\)\s*$/.test(raw);
        const name = t([...nEl.childNodes].filter(c => !(c.classList && c.classList.contains("aufCaptain"))).map(c => c.textContent).join("")).replace(/\s*\(C\)\s*$/, "");
        const nr = t(tr.querySelector(".eventsTime")?.textContent); const pid = tr.getAttribute("data-pid") || name;
        if (sec === "start") L.start.push({nr, name, pid, pos: t(tr.querySelector(".aufPos")?.textContent), cap});
        else if (sec === "bench") L.bench.push({nr, name, pid, out: !!tr.querySelector("img.aufStern, img[src*='stern']")});
        else L.staff.push(name);
      }
      return L;
    });
    const hg = [...d.querySelectorAll("table.shortToreHome tr")].map(tr => t(tr.textContent));
    const ag = [...d.querySelectorAll("table.shortToreGast tr")].map(tr => t(tr.textContent));
    const side = n => lu[0]?.has(n) ? "H" : lu[1]?.has(n) ? "A" : "?";
    let prev = [0, 0];
    o.ev = [...d.querySelectorAll(".bnEventsList > li")].reverse().map(li => {
      const m = t(li.querySelector("time")?.textContent).replace(/'/g, "");
      const lab = t(li.querySelector(".eventlabel")?.textContent);
      const body = li.querySelector(".panel-body > div:nth-child(2)");
      const det = t(body ? [...body.childNodes].filter(n => !(n.classList && n.classList.contains("eventlabel"))).map(n => n.textContent).join(" ") : "");
      const sc = t(li.querySelector(".panel-body > div:nth-child(1)")?.textContent).match(/(\d+):(\d+)/);
      if (/^Tor|^Eigentor/.test(lab)) {
        let p = det.replace("Torschütze ", "").replace("Eigentor ", ""); let ty = /^Eigentor/.test(lab) ? "OG" : "G";
        if (/\(Penalty\)/.test(p)) { ty = "P"; p = p.replace(/\s*\(Penalty\)/, ""); }
        p = p.trim();
        let s = "?";
        if (sc) { const a = +sc[1], b = +sc[2]; if (a > prev[0] && b === prev[1]) s = "H"; else if (b > prev[1] && a === prev[0]) s = "A"; prev = [a, b]; }
        if (s === "?") s = hg.some(x => x.includes(p)) ? "H" : ag.some(x => x.includes(p)) ? "A" : "?";
        if (s === "?" && ty !== "OG") s = side(p);
        return [m, ty, s, p].join(";");
      }
      const r = lab.match(/^(Verwarnung|Ausschluss) (.+?) \(/);
      if (r) { const p = r[2].trim(); return [m, r[1] === "Verwarnung" ? "Y" : (/2\. Verwarnung/.test(det) ? "YR" : "R"), side(p), p].join(";"); }
      const s2 = det.match(/^(.+?) ersetzt durch (.+)$/);
      if (s2) return [m, "S", side(s2[1].trim()), s2[1].trim() + ">" + s2[2].trim()].join(";");
      return null;
    }).filter(Boolean).join("~");
    return o;
  }

  async function fillTelegrams(games) {
    const todo = games.filter(g => g.gh !== null && !g.forfait);
    let i = 0;
    const w = async () => {
      while (i < todo.length) {
        const g = todo[i++];
        try {
          Object.assign(g, telegram(await get("/default.aspx?oid=6&lng=1&ln=&v=0&tg=" + g.tg)));
          if (g.reg) { g.gh = g.reg[0]; g.ga = g.reg[1]; delete g.reg; }
        } catch (e) { S.log.push(String(e)); }
        S.done = (S.done || 0) + 1;
        await sleep(250);
      }
    };
    await Promise.all([w(), w(), w()]);
  }

  try {
    const result = {updated: new Date().toISOString(), season: "2026/27", leagues: {}, cup: {}};
    const LEAGUES = {promo: ["15308", "Junioren B Promotion"], yl: ["15303", "BRACK.CH Youth League B"]};
    for (const [key, [ln, name]] of Object.entries(LEAGUES)) {
      S.status = "Liga " + name;
      const groups = await groupsOf(ln);
      const rounds = [];
      for (const g of groups) {
        const dr = await get(`${BASE}&ln=${ln}&ls=${g.ls}&sg=${g.sg}&a=mrr`); await sleep(300);
        const ds = await get(`${BASE}&ln=${ln}&ls=${g.ls}&sg=${g.sg}&a=msp`); await sleep(300);
        rounds.push({name: g.name, ls: g.ls, sg: g.sg, table: table(dr), games: listGames(ds, {})});
      }
      result.leagues[key] = {name, ln, rounds};
    }
    // Stärkeklassen (mit Gruppen)
    const SKS = {sk1: ["15311", "Junioren B 1. Stärkeklasse"], sk2: ["15312", "Junioren B 2. Stärkeklasse"]};
    result.sks = {};
    for (const [key, [ln, name]] of Object.entries(SKS)) {
      S.status = name;
      const groups = await groupsOf(ln); const gr = [];
      for (const g of groups) {
        const dr = await get(`${BASE}&ln=${ln}&ls=${g.ls}&sg=${g.sg}&a=mrr`); await sleep(300);
        const ds = await get(`${BASE}&ln=${ln}&ls=${g.ls}&sg=${g.sg}&a=msp`); await sleep(300);
        gr.push({name: g.name, ls: g.ls, sg: g.sg, table: table(dr), games: listGames(ds, {})});
      }
      result.sks[key] = {name, ln, groups: gr};
    }
    // EQUIP.Lab Berner Cup Junioren B
    S.status = "Cup";
    const cpEq = "5256";
    const dc = await get(`${BASE}&cp=${cpEq}`);
    const firstBy = (links) => { const m = new Map(); links.forEach(a => { const cr = a.getAttribute("href").match(/cr=(\d+)/)[1]; const n = t(a.textContent); if (!m.has(cr) && !/^Resultate$/.test(n)) m.set(cr, n); }); return [...m.entries()]; };
    const crs = firstBy([...dc.querySelectorAll('a[href*="a=cre"]')]).map(([cr, name]) => ({cr, name}));
    const eqRounds = [];
    for (const r of crs) {
      const d = await get(`${BASE}&cp=${cpEq}&cr=${r.cr}&a=cre`); await sleep(300);
      const nm = r.name.replace(/\s*-\s*\d\d\.\d\d\.\d{4}$/, "").replace(/\s*-\s*Final$/, "-Final").trim();
      eqRounds.push({name: nm, cr: r.cr, games: listGames(d, {})});
    }
    result.cup.eq = {name: "EQUIP.Lab Berner Cup – Junioren B", cp: cpEq, rounds: eqRounds};
    // Cup BCJ Junioren B (nur Spiele der Promotion-Teams, für die Torschützenliste)
    const promoTeams = new Set(result.leagues.promo.rounds.flatMap(r => r.table.map(x => x.team)));
    const bcj = [];
    try {
      const gsB = await groupsOf("15281");
      for (const g of gsB) { const d = await get(`${BASE}&ln=15281&ls=${g.ls}&sg=${g.sg}&a=msp`); await sleep(300); bcj.push(...listGames(d, {round: g.name})); }
      const dk = await get(`${BASE}&cp=5348`);
      const crB = firstBy([...dk.querySelectorAll('a[href*="a=cre"]')]);
      for (const [cr, n] of crB) { const d = await get(`${BASE}&cp=5348&cr=${cr}&a=cre`); await sleep(300); bcj.push(...listGames(d, {round: n.replace(/\s*-\s*\d\d\.\d\d\.\d{4}$/, "").replace(/\s*-\s*Final$/, "-Final").trim()})); }
    } catch (e) { S.log.push("BCJ: " + e); }
    result.cup.bcj = {name: "Cup BCJ – Junioren B", games: bcj.filter(g => promoTeams.has(g.home) || promoTeams.has(g.away))};
    // Spielberichte
    const all = [...Object.values(result.leagues).flatMap(l => l.rounds.flatMap(r => r.games)), ...Object.values(result.sks).flatMap(x => x.groups.flatMap(g => g.games)), ...eqRounds.flatMap(r => r.games), ...result.cup.bcj.games];
    S.total = all.filter(g => g.gh !== null && !g.forfait).length; S.done = 0; S.status = "Spielberichte";
    await fillTelegrams(all);
    const logos = {};
    all.forEach(g => { if (g.logoH) logos[g.home] = g.logoH; if (g.logoA) logos[g.away] = g.logoA; });
    result.logos = logos;
    result.log = S.log;
    S.result = result; S.status = "fertig";
  } catch (e) { S.status = "Fehler: " + e; }
})();
"gestartet";

// ---- Export: kompakte Textdatei (Format von data.txt) + Hash ----
window.__export = () => {
  const R = window.__S.result;
  const tagOf = n => (n.match(/\((Jun\.\s?B[^)]*|YL B)\)$/) || [])[1] || "";
  const ours = new Set([...Object.values(R.leagues).flatMap(l => l.rounds.flatMap(r => r.table.map(x => x.team))), ...Object.values(R.sks || {}).flatMap(s => s.groups.flatMap(g => g.table.map(x => x.team)))]);
  const G = (g, round) => {
    let ev = g.ev || "";
    if (!ours.has(g.home) && !ours.has(g.away)) ev = ev.split("~").filter(e => e && e.split(";")[1] !== "S").join("~");
    return ["G", g.tg, g.date || "", g.time || "", g.home, g.away, g.gh ?? "", g.ga ?? "", g.nr || "", (g.venue || "").replace(/\s*-\s*Attribution du terrain de jeu sur place - Spielfeld wird vor Ort zugeteilt/, ""), g.ht || "", g.pens || "", g.forfait ? "F" : "", tagOf(g.hl || ""), tagOf(g.al || ""), round || "", ev].join("|");
  };
  const L = ["UPDATED|" + R.updated];
  for (const [k, l] of Object.entries(R.leagues)) {
    L.push(["LEAGUE", k, l.name, l.ln].join("|"));
    for (const r of l.rounds) { L.push(["ROUND", r.name, r.ls, r.sg].join("|")); r.table.forEach(x => L.push(["T", x.rank, x.team, x.sp, x.s, x.u, x.n, x.strp, x.gf, x.ga, x.pts].join("|"))); r.games.forEach(g => L.push(G(g))); }
  }
  L.push("CUP|eq|" + R.cup.eq.name); R.cup.eq.rounds.forEach(r => r.games.forEach(g => L.push(G(g, r.name))));
  L.push("CUP|bcj|" + R.cup.bcj.name); R.cup.bcj.games.forEach(g => L.push(G(g, g.round)));
  for (const [k, sk] of Object.entries(R.sks || {})) {
    L.push(["SK", k, sk.name, sk.ln].join("|"));
    sk.groups.forEach(g => {
      const gn = (g.name.match(/Gruppe\s*(\d+)/) || [, "?"])[1];
      const rname = g.name.replace(/\s*-\s*Gruppe\s*\d+/i, "").trim() || "Herbstrunde";
      const rk = /Frühjahr|Frühling|Rückrunde/i.test(rname) ? "fj" : "hb";
      const lkey = `${k}_${rk}_g${gn}`;
      L.push(["SKG", k, rk, rname, lkey, "Gruppe " + gn].join("|"));
      L.push(["LEAGUE", lkey, sk.name + " · Gruppe " + gn, sk.ln].join("|"));
      L.push(["ROUND", rname, g.ls, g.sg].join("|"));
      g.table.forEach(x => L.push(["T", x.rank, x.team, x.sp, x.s, x.u, x.n, x.strp, x.gf, x.ga, x.pts].join("|")));
      g.games.forEach(gm => L.push(G(gm, rname)));
    });
  }
  // Aufstellungen kompakt (nur Teams aus YL und Promotion): PL|code|Stammnummer|Name, POS|Positionen, LU|tg|H/A|Startelf|Bank
  // Eintrag: code[.pos][#nr wenn abweichend][! Captain][* kein Einsatz]
  const allG = [...Object.values(R.leagues).flatMap(l => l.rounds.flatMap(r => r.games)), ...Object.values(R.sks || {}).flatMap(s => s.groups.flatMap(g => g.games)), ...R.cup.eq.rounds.flatMap(r => r.games), ...R.cup.bcj.games];
  const ent = [], seen = new Set();
  allG.forEach(g => (g.lineup || []).forEach((l, k) => { const sd = k ? "A" : "H"; const team = k ? g.away : g.home;
    if (!ours.has(team) || seen.has(g.tg + sd) || (!l.start.length && !l.bench.length)) return; seen.add(g.tg + sd); ent.push({tg: g.tg, sd, l}); }));
  const key = p => p.pid + "|" + p.name;
  const nrs = new Map();
  ent.forEach(e => [...e.l.start, ...e.l.bench].forEach(p => { const m = nrs.get(key(p)) || new Map(); m.set(p.nr, (m.get(p.nr) || 0) + 1); nrs.set(key(p), m); }));
  const pc = new Map(), pos = new Map(), PL = [], LU = [];
  const code = p => { const k = key(p); if (!pc.has(k)) { const nr = [...nrs.get(k).entries()].sort((a, b) => b[1] - a[1])[0][0]; pc.set(k, {c: pc.size.toString(36), nr}); PL.push("PL|" + pc.get(k).c + "|" + nr + "|" + p.name); } return pc.get(k); };
  const posI = x => { if (!pos.has(x)) pos.set(x, pos.size.toString(36)); return pos.get(x); };
  const one = (p, st) => { const c = code(p); return c.c + (st ? "." + posI(p.pos) : "") + (p.nr !== c.nr ? "#" + p.nr : "") + (p.cap ? "!" : "") + (p.out ? "*" : ""); };
  ent.forEach(e => LU.push(["LU", e.tg, e.sd, e.l.start.map(p => one(p, true)).join(","), e.l.bench.map(p => one(p, false)).join(",")].join("|")));
  L.push(...PL); L.push("POS|" + [...pos.keys()].join(";")); L.push(...LU);
  L.push("LOGOS|" + Object.entries(R.logos).map(([n, i]) => n + "=" + i).join(";"));
  const txt = L.join("\n") + "\n";
  const body = L.slice(1).join("\n");
  let h = 2166136261; for (let i = 0; i < body.length; i++) { h ^= body.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  window.__txt = txt; window.__hash = h.toString(16);
  return {hash: window.__hash, kb: Math.round(txt.length / 1024), chunks: Math.ceil(txt.length / 30000), games: L.filter(x => x.startsWith("G|")).length, log: R.log};
};
