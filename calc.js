/* ============================================================
 * LoanPlan Finder 2026 — demo prototype
 * RAP formula per public analyses of P.L. 119-21 (TICAS/Brookings).
 * VERIFY against statutory text before production use.
 * ============================================================ */

// Simplified flat state rates for the forgiveness-tax estimate (demo only)
const STATE_TAX = {
  "CA": 0.093, "NY": 0.0685, "MA": 0.05, "IL": 0.0495, "PA": 0.0307,
  "OH": 0.035, "GA": 0.0539, "TX": 0.0, "FL": 0.0, "WA": 0.0,
  "TN": 0.0, "OTHER": 0.05
};

// RAP marginal tiers: 1% of AGI in the $10k-20k band, 2% in $20k-30k, ... 10% above $100k
const RAP_BRACKETS = [
  { lo: 10000,  hi: 20000,     rate: 0.01 },
  { lo: 20000,  hi: 30000,     rate: 0.02 },
  { lo: 30000,  hi: 40000,     rate: 0.03 },
  { lo: 40000,  hi: 50000,     rate: 0.04 },
  { lo: 50000,  hi: 60000,     rate: 0.05 },
  { lo: 60000,  hi: 70000,     rate: 0.06 },
  { lo: 70000,  hi: 80000,     rate: 0.07 },
  { lo: 80000,  hi: 90000,     rate: 0.08 },
  { lo: 90000,  hi: 100000,    rate: 0.09 },
  { lo: 100000, hi: Infinity,  rate: 0.10 }
];

function rapMonthlyPayment(agi, children) {
  let annual = 0;
  for (const b of RAP_BRACKETS) {
    if (agi > b.lo) annual += (Math.min(agi, b.hi) - b.lo) * b.rate;
  }
  let monthly = annual / 12;
  monthly -= 50 * children;          // $50/mo deduction per dependent child
  return Math.max(monthly, 10);      // $10/mo statutory minimum
}

function amortPayment(balance, annualRate, months) {
  const r = annualRate / 12;
  if (r === 0) return balance / months;
  return balance * r / (1 - Math.pow(1 + r, -months));
}

// Simulate a fixed monthly payment against an accruing balance.
// Returns { series (monthly balances), totalPaid, forgiven (balance at month `months`), payoffMonth }
function simulate(balance, annualRate, monthlyPayment, months) {
  const r = annualRate / 12;
  let bal = balance;
  const series = [bal];
  let totalPaid = 0;
  let payoffMonth = null;
  for (let m = 1; m <= months; m++) {
    if (bal <= 0) { series.push(0); continue; }
    bal += bal * r;                       // interest accrues (demo: no RAP subsidy)
    const pay = Math.min(monthlyPayment, bal);
    bal -= pay;
    totalPaid += pay;
    series.push(Math.max(bal, 0));
    if (bal <= 0.5 && payoffMonth === null) payoffMonth = m;
  }
  return { series, totalPaid, forgiven: Math.max(bal, 0), payoffMonth };
}

const fmt$ = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmt$2 = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------------- Chart (hand-rolled SVG, no dependencies) ---------------- */
function drawChart(container, seriesList, maxMonths) {
  const W = 640, H = 300, P = { l: 56, r: 12, t: 12, b: 30 };
  const maxY = Math.max(...seriesList.flatMap(s => s.points), 1);
  const x = m => P.l + (m / maxMonths) * (W - P.l - P.r);
  const y = v => P.t + (1 - v / maxY) * (H - P.t - P.b);

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Loan balance over time">`;
  // gridlines + y labels
  for (let i = 0; i <= 4; i++) {
    const v = maxY * i / 4, yy = y(v);
    svg += `<line x1="${P.l}" y1="${yy}" x2="${W - P.r}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${P.l - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#64748b">$${Math.round(v / 1000)}k</text>`;
  }
  // x labels
  for (let yr = 0; yr <= maxMonths / 12; yr += 5) {
    svg += `<text x="${x(yr * 12)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#64748b">yr ${yr}</text>`;
  }
  // lines
  for (const s of seriesList) {
    const pts = [];
    for (let m = 0; m <= maxMonths; m += 3) {
      const v = s.points[Math.min(m, s.points.length - 1)];
      pts.push(`${x(m).toFixed(1)},${y(v).toFixed(1)}`);
    }
    svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`;
  }
  svg += `</svg>`;
  container.innerHTML = svg;
}

/* ---------------- Page wiring ---------------- */
function initCalculator() {
  const form = document.getElementById("calc-form");
  if (!form) return;

  // Per-page prefill: <form data-defaults='{"agi":75000,"pslf":true}'>
  try {
    const defaults = JSON.parse(form.dataset.defaults || "{}");
    for (const [k, v] of Object.entries(defaults)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = v;
    }
  } catch (e) { /* ignore */ }

  form.addEventListener("submit", (ev) => { ev.preventDefault(); run(); });
  run(); // auto-run with defaults so the page shows results immediately

  function run() {
    const f = form.elements;
    const agi = Math.max(0, +f.agi.value || 0);
    const children = Math.max(0, +f.children.value || 0);
    const balance = Math.max(0, +f.balance.value || 0);
    const rate = Math.max(0, +f.rate.value || 0) / 100;
    const pslf = f.pslf.checked;
    const fedTax = (+f.fedTax.value || 22) / 100;
    const stateTax = STATE_TAX[f.state.value] ?? 0.05;

    const results = document.getElementById("results");
    if (balance <= 0) {
      let warn = document.getElementById("warn");
      if (!warn) {
        warn = document.createElement("div");
        warn.id = "warn";
        warn.className = "alert warn";
        results.prepend(warn);
      }
      warn.innerHTML = `<b>Enter your loan balance</b>This tool compares federal repayment plans, so it needs a balance to work with.`;
      results.classList.add("invalid");
      return;
    }
    results.classList.remove("invalid");

    // --- Plans ---
    const rapPay = rapMonthlyPayment(agi, children);
    const stdPay = amortPayment(balance, rate, 120);

    const rap = simulate(balance, rate, rapPay, 360);        // RAP: 30-year term
    const std = simulate(balance, rate, stdPay, 120);        // Standard: 10-year
    const pslfSim = pslf ? simulate(balance, rate, rapPay, 120) : null; // PSLF: 120 RAP payments

    // Forgiveness tax ("tax bomb"): RAP balance forgiven at year 30 is taxable income
    const forgiven = rap.forgiven;
    const taxOnForgiven = forgiven * (fedTax + stateTax);
    const rapTotalCost = rap.totalPaid + taxOnForgiven;
    const pslfTotalCost = pslfSim ? pslfSim.totalPaid : null; // PSLF forgiveness is tax-free

    // Pick cheapest plan
    const plans = [
      { key: "rap", cost: rapTotalCost },
      { key: "std", cost: std.totalPaid },
    ];
    if (pslfSim) plans.push({ key: "pslf", cost: pslfTotalCost });
    plans.sort((a, b) => a.cost - b.cost);
    const best = plans[0].key;

    const forgivenYear = new Date().getFullYear() + 30;

    // --- Render metric cards ---
    const monthlyDelta = stdPay - rapPay;
    document.getElementById("cards").innerHTML = `
      <div class="metric blue">
        <div class="label">Your RAP payment (new 2026 plan)</div>
        <div class="value">${fmt$2(rapPay)}<span style="font-size:14px;font-weight:600">/mo</span></div>
        <div class="note">${agi <= 10000 ? "Statutory $10 minimum (income at/below first tier before child deduction)" : "Marginal tiers: 1%–10% of AGI"}${children > 0 ? ` · includes −$${children * 50}/mo for ${children} child${children > 1 ? "ren" : ""}` : ""}</div>
      </div>
      <div class="metric">
        <div class="label">Standard 10-year payment</div>
        <div class="value">${fmt$2(stdPay)}<span style="font-size:14px;font-weight:600">/mo</span></div>
        <div class="note">What you get auto-moved to if you ignore your 90-day SAVE notice</div>
      </div>
      <div class="metric ${monthlyDelta >= 0 ? "good" : "bad"}">
        <div class="label">${monthlyDelta >= 0 ? "RAP lowers your payment by" : "RAP costs MORE per month by"}</div>
        <div class="value">${fmt$2(Math.abs(monthlyDelta))}<span style="font-size:14px;font-weight:600">/mo</span></div>
        <div class="note">${monthlyDelta >= 0 ? "But a lower payment can mean decades more interest" : "Higher-income borrowers often pay more under RAP than under old IBR"}</div>
      </div>
      ${pslfSim ? `
      <div class="metric good">
        <div class="label">PSLF track (120 payments)</div>
        <div class="value">${fmt$(pslfSim.totalPaid)}</div>
        <div class="note">Total you'd pay before tax-FREE forgiveness of ${fmt$(pslfSim.forgiven)} in 10 years</div>
      </div>` : `
      <div class="metric ${forgiven > 0 ? "bad" : "good"}">
        <div class="label">Forgiveness tax bomb (RAP, year ${forgivenYear})</div>
        <div class="value">${forgiven > 0 ? fmt$(taxOnForgiven) : "$0"}</div>
        <div class="note">${forgiven > 0 ? `${fmt$(forgiven)} forgiven × ~${Math.round((fedTax + stateTax) * 100)}% (fed ${Math.round(fedTax * 100)}% + state) — taxable since Jan 1, 2026` : "Loan pays off before the 30-year mark — nothing forgiven, nothing taxed"}</div>
      </div>`}
    `;

    // --- Chart ---
    const seriesList = [
      { label: "RAP (30 yr)", color: "#2563eb", points: rap.series },
      { label: "Standard (10 yr)", color: "#64748b", points: std.series.concat(new Array(241).fill(0)) },
    ];
    if (pslfSim) seriesList.push({ label: "PSLF track (10 yr)", color: "#16a34a", points: pslfSim.series.concat(new Array(241).fill(0)) });
    drawChart(document.getElementById("chart"), seriesList, 360);
    document.getElementById("legend").innerHTML = seriesList.map(s =>
      `<span><span class="dot" style="background:${s.color}"></span>${s.label}</span>`).join("");

    // --- Comparison table ---
    const tag = k => best === k ? `<span class="best-tag">LOWEST TOTAL COST</span>` : "";
    document.getElementById("compare-table").innerHTML = `
      <table class="compare">
        <thead><tr><th>Plan</th><th>Monthly now</th><th>Total paid</th><th>Tax on forgiven</th><th>True lifetime cost</th></tr></thead>
        <tbody>
          <tr>
            <td><b>RAP</b> (income-driven, 30 yr)${tag("rap")}</td>
            <td class="num">${fmt$2(rapPay)}</td>
            <td class="num">${fmt$(rap.totalPaid)}</td>
            <td class="num">${fmt$(taxOnForgiven)}</td>
            <td class="num"><b>${fmt$(rapTotalCost)}</b></td>
          </tr>
          <tr>
            <td><b>Standard 10-year</b>${tag("std")}</td>
            <td class="num">${fmt$2(stdPay)}</td>
            <td class="num">${fmt$(std.totalPaid)}</td>
            <td class="num">$0</td>
            <td class="num"><b>${fmt$(std.totalPaid)}</b></td>
          </tr>
          ${pslfSim ? `
          <tr>
            <td><b>PSLF</b> (RAP payments + public-service job, 10 yr)${tag("pslf")}</td>
            <td class="num">${fmt$2(rapPay)}</td>
            <td class="num">${fmt$(pslfSim.totalPaid)}</td>
            <td class="num">$0 (tax-free)</td>
            <td class="num"><b>${fmt$(pslfTotalCost)}</b></td>
          </tr>` : ""}
        </tbody>
      </table>
      <p class="note" style="font-size:12px;color:#64748b;margin-top:8px">
        Demo assumes income and rates stay flat; real RAP payments adjust each year with your AGI.
        RAP interest-subsidy rules are pending final regulation — figure shown is the conservative (interest keeps accruing) case.
      </p>`;

    // --- "Do nothing" alert ---
    document.getElementById("do-nothing").innerHTML = `
      <div class="alert">
        <b>If you were on SAVE and do nothing:</b>
        Your servicer auto-moves you to Standard repayment after the 90-day window —
        that's <b>${fmt$2(stdPay)}/mo instead of ${fmt$2(rapPay)}/mo</b> in this scenario
        (${fmt$2(Math.max(stdPay - rapPay, 0))}/mo more, every month). Missing payments sends you toward default,
        where the Treasury can garnish wages and tax refunds.
      </div>`;

    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.addEventListener("DOMContentLoaded", initCalculator);
