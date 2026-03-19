// Mode color palette — extends automatically for new modes
const MODE_COLORS = {
  'Negative':    { line: '#ff5c00', bg: 'rgba(255,92,0,0.08)',   point: '#ff5c00' },
  'Adaptive':    { line: '#00e5a0', bg: 'rgba(0,229,160,0.08)',  point: '#00e5a0' },
  'Isokinetic':  { line: '#4e9eff', bg: 'rgba(78,158,255,0.08)', point: '#4e9eff' },
};

const FALLBACK_COLORS = ['#c084fc','#f9a825','#e91e63','#00bcd4'];

function getModeColor(mode, index) {
  if (MODE_COLORS[mode]) return MODE_COLORS[mode];
  const c = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return { line: c, bg: c.replace(')', ',0.08)').replace('rgb','rgba'), point: c };
}

function buildOverview(data) {
  const { bests, prRows } = computePRs(data);
  const dates = getUniqueDates(data);
  const totalWorkouts = dates.length;
  const totalPRs = prRows.length;
  const lastDate = dates[dates.length - 1] || '-';

  const volByMachine = {};
  data.forEach(r => { volByMachine[r.machine] = (volByMachine[r.machine] || 0) + r.sets * r.reps * r.weight; });
  const sortedMachines = Object.entries(volByMachine).sort((a, b) => b[1] - a[1]);
  const maxVol = sortedMachines[0]?.[1] || 1;

  return `
  <div class="page active fade-in" id="page-overview">
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Workouts</div>
        <div class="kpi-val">${totalWorkouts}</div>
        <div class="kpi-sub">sessions</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">PRs Set</div>
        <div class="kpi-val">${totalPRs}</div>
        <div class="kpi-sub">all time</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Last Session</div>
        <div class="kpi-val" style="font-size:18px; padding-top:4px;">${formatDate(lastDate)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">Volume by machine</span>
        <span class="section-badge">sets × reps × kg</span>
      </div>
      ${sortedMachines.map(([machine, vol]) => `
        <div class="vol-bar-row">
          <span class="vol-label">${machine.replace('EGYM ', '')}</span>
          <div class="vol-track"><div class="vol-fill" style="width:${Math.round(vol/maxVol*100)}%"></div></div>
          <span class="vol-val">${Math.round(vol).toLocaleString()}</span>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">Top PRs</span>
      </div>
      <div class="pr-list">
        ${Object.entries(bests).sort((a,b) => b[1]-a[1]).slice(0,5).map(([machine, weight]) => {
          const prRow = prRows.filter(r => r.machine === machine).pop();
          return `
          <div class="pr-item highlight">
            <div>
              <div class="pr-machine">${machine.replace('EGYM ', '')}</div>
              <div class="pr-date">${formatDate(prRow?.date)}</div>
            </div>
            <div class="pr-weight">${weight} kg</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

function buildProgress(data) {
  const machines = [...new Set(data.map(r => r.machine))].sort();
  const firstMachine = machines[0] || '';
  const modes = [...new Set(data.filter(r => r.machine === firstMachine).map(r => r.mode))].filter(Boolean).sort();
  return `
  <div class="page fade-in" id="page-progress">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
      <select class="machine-select" id="machine-select" onchange="onMachineChange()" style="margin-bottom:0;">
        ${machines.map(m => `<option value="${m}">${m.replace('EGYM ', '')}</option>`).join('')}
      </select>
      <select class="machine-select" id="mode-select" onchange="updateProgressChart()" style="margin-bottom:0;">
        <option value="all">All modes</option>
        ${modes.map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
    </div>
    <div class="section">
      <div class="section-header">
        <span class="section-title">Weight over time</span>
        <span class="section-badge" id="chart-pr-badge"></span>
      </div>
      <div class="chart-wrap">
        <canvas id="progressChart"></canvas>
      </div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-title">Session log</span></div>
      <div class="history-list" id="machine-log"></div>
    </div>
  </div>`;
}

function buildPRs(data) {
  const { prRows } = computePRs(data);
  const sorted = [...prRows].sort((a, b) => b.weight - a.weight);
  return `
  <div class="page fade-in" id="page-prs">
    <div class="section">
      <div class="section-header">
        <span class="section-title">All-time personal records</span>
        <span class="section-badge">${sorted.length} PRs</span>
      </div>
      <div class="pr-list">
        ${sorted.map((r, i) => `
        <div class="pr-item ${i < 3 ? 'highlight' : ''}">
          <div>
            <div class="pr-machine">${i < 3 ? '🏆 ' : ''}${r.machine.replace('EGYM ', '')}</div>
            <div class="pr-date">${formatDate(r.date)} · ${r.sets}×${r.reps}</div>
          </div>
          <div class="pr-weight">${r.weight} kg</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function buildHistory(data) {
  const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
  const { bests } = computePRs(data);
  return `
  <div class="page fade-in" id="page-history">
    <div class="section">
      <div class="section-header">
        <span class="section-title">All sessions</span>
        <span class="section-badge">${sorted.length} entries</span>
      </div>
      <div class="history-list">
        ${sorted.map(r => `
        <div class="history-item">
          <div class="history-left">
            <div class="history-machine">${r.machine.replace('EGYM ', '')}${r.weight === bests[r.machine] ? '<span class="pr-badge">PR</span>' : ''}</div>
            <div class="history-meta">${formatDate(r.date)} · ${r.sets}×${r.reps} · ${r.mode}</div>
          </div>
          <div class="history-right">
            <div class="history-weight">${r.weight} kg</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function buildSessionLogItem(r, allMaxW, modes) {
  const color = getModeColor(r.mode, modes.indexOf(r.mode));
  return `
  <div class="history-item">
    <div class="history-left">
      <div class="history-machine">${formatDate(r.date)}
        <span style="font-size:9px; background:${color.line}22; color:${color.line}; padding:1px 7px; border-radius:6px; margin-left:5px; vertical-align:middle;">${r.mode}</span>
      </div>
      <div class="history-meta">${r.sets} sets × ${r.reps} reps</div>
    </div>
    <div class="history-right">
      <div class="history-weight">${r.weight} kg${r.weight === allMaxW ? '<span class="pr-badge">PR</span>' : ''}</div>
    </div>
  </div>`;
}
