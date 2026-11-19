// Captures of the site for the reel (Playwright), one order on both devices:
//   tablet run: example orders «yesterday» (each in its own browser with a fixed clock), the owner's phone in its own
//   context with its own paused clock watching the orders page, then the client's path on the tablet (cart, filled form,
//   order page). The order the tablet places reaches the owner's phone through the site's own storage (a helper tab of
//   the owner's browser writes it, as a push would), and the owner's screen is shot frame by frame (33 ms): the notice,
//   the row, the tap on the accept button.
//   phone run: the product card.
// Every state: a viewport PNG (public/dev/<device>/<state>.png) and boxes, texts with letter heights, and words
// (src/states/states_<device>.json), the format the reel and the checks read.
// The site must run its ad build (no «demo» notices, the owner's dashboard with a stretched arrival and an accept button).
// The variant reaches the site here: the palette's colours as CSS variables (capture.cssVars) and its colour scheme, and
// the side the notice and the new row slide in from as a query parameter of the orders page (capture.enterParam). The
// ad build must read them; checks/variant_check.py capture tells whether the captures follow them.
// node capture/capture.js tablet|phone          (config.json «capture»; Playwright from capture.playwrightModule)
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const C = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const K = C.capture, L = C.labels, V = C.variant, P = C.palettes[V.palettePreset];
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || K.playwrightModule);
const DEVICES = { phone: { width: 390, height: 844, dsf: 4, touch: true }, tablet: { width: 820, height: 1180, dsf: 3, touch: true } };
const dev = process.argv[2], D = DEVICES[dev];
if (!D) { console.error("usage: node capture/capture.js tablet|phone"); process.exit(1); }
const OUT = path.join(ROOT, "public", "dev", dev);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(ROOT, "src", "states"), { recursive: true });
const states = {};
const SCHEME = P.mode === "light" ? "light" : "dark";
const VARS = Object.entries(K.cssVars || {}).filter(([k]) => !k.startsWith("_") && P[k]).map(([k, name]) => `${name}:${P[k]}`).join(";");
const ORDERS = K.ordersPath + (K.enterParam ? `?${K.enterParam}=${V.enterFrom}` : "");
// every page of every context gets the palette before the site's own script runs
async function themed(ctx) { if (VARS) await ctx.addInitScript((css) => { const put = () => { const st = document.createElement("style"); st.textContent = `:root{${css}}`; document.documentElement.appendChild(st); }; if (document.documentElement) put(); else document.addEventListener("DOMContentLoaded", put); }, VARS); return ctx; }

// runs in the page: boxes (viewport CSS px), every text node with its letter height, every word (for the checks)
const BOXES = (opt) => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10) : null; };
  const vis = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0) return false; } return true; };
  const o = { scrollY, vw: innerWidth, vh: innerHeight, url: location.pathname, el: {} };
  const put = (k, e) => { const b = r(e); if (b) o.el[k] = b; };
  put("header", document.querySelector("header"));
  put("h1", document.querySelector("main h1"));
  const price = [...document.querySelectorAll("main *")].find((e) => e.children.length === 0 && e.textContent.trim() === opt.total && parseFloat(getComputedStyle(e).fontSize) > 22);
  put("productPrice", price);
  const btn = [...document.querySelectorAll("a,button")].find((a) => a.innerText && a.innerText.trim().toLowerCase() === opt.checkout.toLowerCase() && vis(a));
  put("checkoutBtn", btn);
  // the owner's dashboard: rows, the notice, the accept button, the status badge
  o.el.rows = [...document.querySelectorAll("li")].map(r);
  put("toast", document.querySelector("[role=status]"));
  put("accept", document.querySelector("li button"));
  const cv = document.createElement("canvas").getContext("2d");
  o.words = []; o.texts = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode, v = t.nodeValue || ""; if (!v.trim() || !vis(t.parentElement)) continue;
    const rg = document.createRange(); rg.selectNodeContents(t); const b = rg.getBoundingClientRect();
    if (!b.width || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
    const cs = getComputedStyle(t.parentElement); cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    let txt = v.trim(); if (cs.textTransform === "uppercase") txt = txt.toUpperCase();
    const hasCap = /[A-ZА-ЯЁ0-9№]/.test(txt) || /\p{Sc}/u.test(txt), m = cv.measureText(hasCap ? "НH08" : "нxао");
    o.texts.push({ t: txt.slice(0, 60), box: [b.x, b.y, b.width, b.height].map((q) => Math.round(q * 10) / 10), fs: parseFloat(cs.fontSize), letter: Math.round(m.actualBoundingBoxAscent * 10) / 10, kind: hasCap ? "cap" : "x" });
    const re = /\S+/g; let mm;
    while ((mm = re.exec(v))) { const r2 = document.createRange(); r2.setStart(t, mm.index); r2.setEnd(t, mm.index + mm[0].length); for (const q of r2.getClientRects()) if (q.width) o.words.push([q.x, q.y, q.width, q.height].map((z) => Math.round(z * 10) / 10).concat([mm[0].slice(0, 30)])); }
  }
  return o;
};
const OPT = { total: C.order.totalText, checkout: K.checkoutLink };
async function settle(p) { await p.waitForTimeout(500); await p.evaluate(async () => { await (document.fonts && document.fonts.ready); }); await p.waitForTimeout(200); }
async function shot(p, name, store, out = OUT) { await settle(p); const info = await p.evaluate(BOXES, OPT); await p.screenshot({ path: path.join(out, name + ".png") }); store[name] = info; }
const getStore = (k) => ({ orders: localStorage.getItem(k.orders), seq: localStorage.getItem(k.seq) });
const putStore = ([k, st]) => { if (st.orders) localStorage.setItem(k.orders, st.orders); if (st.seq) localStorage.setItem(k.seq, st.seq); };

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars"] });
  const ctx = await themed(await browser.newContext({ viewport: { width: D.width, height: D.height }, deviceScaleFactor: D.dsf, isMobile: D.touch, hasTouch: D.touch, locale: K.locale, colorScheme: SCHEME }));
  const page = await ctx.newPage();
  await page.goto(K.baseUrl + K.productPath, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  if (dev === "phone") {
    await page.goto(K.baseUrl + K.productPath, { waitUntil: "load" });
    await shot(page, "product", states);
  } else {
    // example orders «yesterday», each in its own browser with its clock fixed to that moment
    let store = null;
    for (const ex of K.exampleOrders) {
      const n = new Date(), [hh, mi] = ex.time.split(":").map(Number);
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: K.locale, colorScheme: SCHEME });
      await c.clock.setFixedTime(new Date(n.getFullYear(), n.getMonth(), n.getDate() - ex.daysAgo, hh, mi));
      const p = await c.newPage(); await p.goto(K.baseUrl + ex.path, { waitUntil: "load" });
      if (store) await p.evaluate(putStore, [K.storageKeys, store]);
      await p.goto(K.baseUrl + ex.path, { waitUntil: "load" });
      await p.getByRole("button", { name: K.addToCart, exact: true }).first().click(); await p.waitForTimeout(400);
      await p.goto(K.baseUrl + K.checkoutPath, { waitUntil: "load" });
      await p.fill(K.nameField, ex.name); await p.fill(K.phoneField, C.order.customerPhone);
      await p.locator("form button[type=submit]").first().click();
      await p.waitForURL((u) => !u.pathname.endsWith(K.checkoutPath), { timeout: 30000 });
      store = await p.evaluate(getStore, K.storageKeys); await c.close();
    }
    if (store) await page.evaluate(putStore, [K.storageKeys, store]);
    // the owner's phone: its own browser and clock, watching the orders page
    const oc = await themed(await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: K.locale, colorScheme: SCHEME }));
    await oc.clock.install();
    const op = await oc.newPage(); await op.goto(K.baseUrl + K.productPath, { waitUntil: "load" });
    if (store) await op.evaluate(putStore, [K.storageKeys, store]);
    await op.goto(K.baseUrl + ORDERS, { waitUntil: "load" });
    await shot(op, "owner_before", states);
    // the client's path on the tablet: product, cart drawer, filled form, the order page
    await page.goto(K.baseUrl + K.productPath, { waitUntil: "load" });
    await page.getByRole("button", { name: K.addToCart, exact: true }).first().click(); await page.waitForTimeout(600);
    await shot(page, "drawer", states);
    await page.getByRole("link", { name: new RegExp(K.checkoutLink, "i") }).first().click();
    await page.waitForURL(new RegExp(K.checkoutPath)); await page.evaluate(() => scrollTo(0, 0));
    await page.fill(K.nameField, C.order.customer); await page.locator(K.phoneField).click(); await page.keyboard.type(K.phoneTyped, { delay: 40 });
    await page.evaluate(() => scrollTo(0, 0)); await shot(page, "contacts_filled", states);
    await page.locator("form button[type=submit]").first().click();
    await page.waitForURL((u) => !u.pathname.endsWith(K.checkoutPath), { timeout: 30000 }); await page.evaluate(() => scrollTo(0, 0));
    await shot(page, "order", states);
    // the order reaches the owner: the clock stops, a helper tab of the owner's browser writes the store, then frames
    const after = await page.evaluate(getStore, K.storageKeys);
    await oc.clock.pauseAt(new Date(Date.now() + 60000));
    const helper = await oc.newPage(); await helper.goto(K.baseUrl + K.productPath, { waitUntil: "load" }); await helper.evaluate(putStore, [K.storageKeys, after]);
    await op.waitForTimeout(500);
    let last = 0;
    const moments = [[1500, "owner_orders"]]; for (let k = 0; k <= 60; k++) moments.push([Math.round((k * 1000) / 30), "owner_m_" + String(k).padStart(2, "0")]);
    moments.sort((a, b) => a[0] - b[0]);
    for (const [t, name] of moments) { if (t > last) await oc.clock.runFor(t - last); last = t; await op.waitForTimeout(250); await shot(op, name, states); }
    await oc.clock.runFor(2500 - last); last = 0;
    await shot(op, "owner_accept_pre", states);
    await op.evaluate(() => document.querySelector("li button").click()); // a DOM click: the paused clock stops Playwright's own
    await op.waitForTimeout(300);
    const acc = [[700, "owner_accepted"]]; for (let k = 0; k <= 21; k++) acc.push([Math.round((k * 1000) / 30), "owner_acc_" + String(k).padStart(2, "0")]);
    acc.sort((a, b) => a[0] - b[0]);
    for (const [t, name] of acc) { if (t > last) await oc.clock.runFor(t - last); last = t; await op.waitForTimeout(250); await shot(op, name, states); }
    await oc.close();
  }
  fs.writeFileSync(path.join(ROOT, "src", "states", `states_${dev}.json`), JSON.stringify(states));
  console.log(`${dev}: ${Object.keys(states).length} states; check for ${L.statusNew} and ${L.statusAccepted} in owner_accept_pre / owner_accepted`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
