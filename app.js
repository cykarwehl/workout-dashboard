const SHEET_ID = '1l3J7Jedab0h9viwceYc8TQYp1yhylvOIkT_-Q_-L4pw';
const API_KEY = 'AIzaSyALt9PbCeLs6Iqw8tfrL6GddCG5pUAIWH4';
const RANGE = 'Sheet1!A:G';

let allData = [];
let currentPage = 'overview';
let progressChart = null;

async function fetchData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sheet data');
  const json = await res.json();
  return json.values || [];
}

function parseRows(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => ({
    date: row[0] || '',
    machine: row[1] || '',
    sets: Number.parseInt(row[2]) || 0,
    reps: Number.parseInt(row[3]) || 0,
    weight: Number.parseFloat(row[4]) || 0,
    mode: row[5] || '',
    file: row[6] || ''
  })).filter(r => r.machine && r.date);
}

function computePRs(data) {
  const bests = {};
  const prRows = [];
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  sorted.forEach(row => {
    const prev = bests[row.machine] || 0;
    if (row.weight > prev) {
      bests[row.machine] = row.weight;
      prRows.push({ ...row, isPR: true });
    }
  });
  return { bests, prRows };
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getUniqueDates(data) {
  return [...new Set(data.map(r => r.date))].sort();
}

function getTotalVolume(data) {
  return data.reduce((s, r) => s + r.sets * r.reps * r.weight, 0);
}

function onMachineChange() {
  // Rebuild mode dropdown based on selected machine
  const machine = document.getElementById('machine-select')?.value;
  const modeSelect = document.getElementById('mode-select');
  if (!machine || !modeSelect) return;
  const modes = [...new Set(allData.filter(r => r.machine === machine).map(r => r.mode))].filter(Boolean).sort();
  modeSelect.innerHTML = `<option value="all">All modes</option>` +
    modes.map(m => `<option value="${m}">${m}</option>`).join('');
  updateProgressChart();
}

function updateProgressChart() {
  const machine = document.getElementById('machine-select')?.value;
  const selectedMode = document.getElementById('mode-select')?.value || 'all';
  if (!machine) return;

  // Filter by machine, then optionally by mode
  const machineRows = allData.filter(r => r.machine === machine);
  const modes = selectedMode === 'all'
    ? [...new Set(machineRows.map(r => r.mode))].filter(Boolean).sort()
    : [selectedMode];

  // Build one dataset per mode
  const allDates = [...new Set(machineRows.map(r => r.date))].sort();
  const labels = allDates.map(d => formatDate(d));

  const datasets = modes.map((mode, i) => {
    const color = getModeColor(mode, i);
    const modeRows = machineRows.filter(r => r.mode === mode).sort((a, b) => new Date(a.date) - new Date(b.date));
    // Map each date to weight (null if no entry for that mode on that date)
    const data = allDates.map(d => {
      const row = modeRows.find(r => r.date === d);
      return row ? row.weight : null;
    });
    const maxW = Math.max(...modeRows.map(r => r.weight));
    return {
      label: mode,
      data,
      borderColor: color.line,
      backgroundColor: color.bg,
      borderWidth: 2,
      fill: modes.length === 1,
      tension: 0.3,
      spanGaps: true,
      pointBackgroundColor: data.map(w => w === maxW ? color.point : '#1c1c26'),
      pointBorderColor: color.line,
      pointRadius: 5,
      pointHoverRadius: 7
    };
  });

  // PR badge — show per mode or overall
  const badge = document.getElementById('chart-pr-badge');
  if (badge) {
    if (modes.length === 1) {
      const modeRows = machineRows.filter(r => r.mode === modes[0]);
      const maxW = modeRows.length ? Math.max(...modeRows.map(r => r.weight)) : 0;
      badge.textContent = `PR (${modes[0]}): ${maxW} kg`;
    } else {
      const maxW = machineRows.length ? Math.max(...machineRows.map(r => r.weight)) : 0;
      badge.textContent = `Overall PR: ${maxW} kg`;
    }
  }

  const ctx = document.getElementById('progressChart');
  if (!ctx) return;
  if (progressChart) progressChart.destroy();

  progressChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: modes.length > 1,
          labels: { color: '#999', font: { size: 11 }, boxWidth: 12, padding: 10 }
        },
        tooltip: {
          backgroundColor: '#1c1c26',
          borderColor: 'rgba(255,92,0,0.3)',
          borderWidth: 1,
          titleColor: '#666680',
          bodyColor: '#f0f0f0',
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} kg` }
        }
      },
      scales: {
        x: { ticks: { color: '#666680', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#666680', font: { size: 10 }, callback: v => v + ' kg' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });

  // Session log — filtered by mode
  const filteredRows = machineRows
    .filter(r => selectedMode === 'all' || r.mode === selectedMode)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const allMaxW = machineRows.length ? Math.max(...machineRows.map(r => r.weight)) : 0;
  const log = document.getElementById('machine-log');
  if (log) {
    log.innerHTML = filteredRows.map(r => buildSessionLogItem(r, allMaxW, modes)).join('') || '<div class="empty">No sessions found</div>';
  }
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach((el, i) => {
    el.classList.toggle('active', ['overview','progress','prs','history'][i] === page);
  });
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    if (page === 'progress') setTimeout(updateProgressChart, 50);
  }
}

async function init() {
  try {
    const rows = await fetchData();
    allData = parseRows(rows);

    const lastDate = getUniqueDates(allData).pop() || '';
    document.getElementById('last-sync').textContent = `Last session: ${formatDate(lastDate)}`;

    document.getElementById('app').innerHTML = `
      <main>
        ${buildOverview(allData)}
        ${buildProgress(allData)}
        ${buildPRs(allData)}
        ${buildHistory(allData)}
      </main>`;

    showPage('overview');
  } catch (e) {
    document.getElementById('app').innerHTML = `
      <div class="loading">
        <span style="color:#ff5c00">⚠️ Error loading data</span>
        <span style="font-size:12px">${e.message}</span>
      </div>`;
  }
}

init();
