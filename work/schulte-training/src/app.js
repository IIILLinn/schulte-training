(function () {
  const core = globalThis.SchulteCore;
  const STORAGE_KEY = 'schulte-training-v1';
  const defaultSettings = {
    size: 5,
    order: 'asc',
    arrangement: 'random',
    shape: 'square',
  };

  const elements = {
    board: document.querySelector('#board'),
    settings: document.querySelector('#settings'),
    startBtn: document.querySelector('#startBtn'),
    restartBtn: document.querySelector('#restartBtn'),
    settingsBtn: document.querySelector('#settingsBtn'),
    clearBtn: document.querySelector('#clearBtn'),
    timer: document.querySelector('#timer'),
    target: document.querySelector('#target'),
    errors: document.querySelector('#errors'),
    progressText: document.querySelector('#progressText'),
    progressBar: document.querySelector('#progressBar'),
    statusMessage: document.querySelector('#statusMessage'),
    resultPanel: document.querySelector('#resultPanel'),
    lastTime: document.querySelector('#lastTime'),
    lastErrors: document.querySelector('#lastErrors'),
    bestTime: document.querySelector('#bestTime'),
    historyList: document.querySelector('#historyList'),
  };

  const state = {
    settings: { ...defaultSettings },
    phase: 'idle',
    values: [],
    current: 1,
    completed: 0,
    errors: 0,
    startedAt: 0,
    timerId: null,
    elapsed: 0,
  };

  let stats = loadStats();

  function loadStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && typeof parsed === 'object') {
        return { best: parsed.best || {}, records: Array.isArray(parsed.records) ? parsed.records : [] };
      }
    } catch (_error) {
      // Storage can be unavailable in private browsing contexts.
    }
    return { best: {}, records: [] };
  }

  function persistStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (_error) {
      // The training still works if storage is unavailable.
    }
  }

  function totalValues() {
    return state.settings.size * state.settings.size;
  }

  function firstTarget() {
    return state.settings.order === 'asc' ? 1 : totalValues();
  }

  function nextTarget() {
    return state.settings.order === 'asc' ? state.current + 1 : state.current - 1;
  }

  function createValues() {
    return core.buildValues(
      state.settings.size,
      state.settings.order,
      state.settings.arrangement,
      Math.random,
    );
  }

  function clearTimer() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    const runningFor = state.phase === 'running' ? performance.now() - state.startedAt : state.elapsed;
    if (runningFor > 0) state.elapsed = runningFor;
  }

  function renderSettings() {
    const locked = state.phase === 'running';
    document.querySelectorAll('[data-setting]').forEach((button) => {
      const selected = String(state.settings[button.dataset.setting]) === button.dataset.value;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = locked;
    });
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.disabled = locked;
    });
  }

  function renderBoard(values = createValues()) {
    state.values = values;
    const size = state.settings.size;
    const shape = state.settings.shape;
    elements.board.dataset.shape = shape;
    elements.board.style.setProperty('--size', size);
    elements.board.innerHTML = '';

    const slots = shape === 'circle' ? core.createCircularSlots(size) : null;
    values.forEach((value, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.value = String(value);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `数字 ${value}`);
      cell.textContent = value;
      if (slots) {
        cell.style.setProperty('--x', slots[index].x);
        cell.style.setProperty('--y', slots[index].y);
      }
      cell.addEventListener('click', () => handleCellClick(cell, value));
      elements.board.append(cell);
    });
  }

  function resetToIdle() {
    clearTimer();
    state.phase = 'idle';
    state.elapsed = 0;
    state.completed = 0;
    state.errors = 0;
    state.current = firstTarget();
    elements.resultPanel.hidden = true;
    elements.statusMessage.textContent = '准备好后点击“开始训练”。';
    renderBoard();
    renderSettings();
    updateDisplay();
    renderStats();
  }

  function startGame() {
    clearTimer();
    state.phase = 'running';
    state.elapsed = 0;
    state.completed = 0;
    state.errors = 0;
    state.current = firstTarget();
    state.startedAt = performance.now();
    elements.resultPanel.hidden = true;
    elements.statusMessage.textContent = state.settings.order === 'asc' ? '从 1 开始，依次点击到终点。' : `从 ${totalValues()} 开始倒序点击。`;
    renderBoard();
    renderSettings();
    updateDisplay();
    state.timerId = window.setInterval(updateTimer, 100);
  }

  function updateTimer() {
    if (state.phase !== 'running') return;
    state.elapsed = performance.now() - state.startedAt;
    elements.timer.textContent = core.formatTime(state.elapsed);
  }

  function updateDisplay() {
    const total = totalValues();
    const targetValue = state.phase === 'complete' ? '完成' : state.current;
    elements.timer.textContent = core.formatTime(state.elapsed);
    elements.target.textContent = targetValue;
    elements.errors.textContent = state.errors;
    elements.progressText.textContent = `${state.completed} / ${total}`;
    elements.progressBar.style.width = `${(state.completed / total) * 100}%`;
    elements.startBtn.disabled = state.phase === 'running';
    elements.restartBtn.disabled = state.phase === 'idle';
    elements.settingsBtn.disabled = state.phase === 'idle';
  }

  function handleCellClick(cell, value) {
    if (state.phase !== 'running') return;
    if (value !== state.current) {
      state.errors += 1;
      cell.classList.add('wrong');
      window.setTimeout(() => cell.classList.remove('wrong'), 320);
      elements.statusMessage.textContent = `先找 ${state.current}，不要急着跳数字。`;
      updateDisplay();
      return;
    }

    cell.classList.add('done');
    cell.disabled = true;
    state.completed += 1;
    if (state.completed >= totalValues()) {
      state.current = null;
      finishGame();
      return;
    }
    state.current = nextTarget();
    elements.statusMessage.textContent = `很好，继续找 ${state.current}。`;
    updateDisplay();
  }

  function finishGame() {
    state.elapsed = performance.now() - state.startedAt;
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    state.phase = 'complete';
    state.current = null;
    saveResult();
    updateDisplay();
    renderSettings();
    renderStats();
    elements.statusMessage.textContent = '训练完成，成绩已记录。';
    elements.resultPanel.hidden = false;
  }

  function saveResult() {
    const settings = { ...state.settings };
    const key = core.specKey(settings);
    const previousBest = stats.best[key];
    if (previousBest === undefined || state.elapsed < previousBest) {
      stats.best[key] = state.elapsed;
    }
    stats.records.unshift({
      key,
      settings,
      size: settings.size,
      order: settings.order,
      arrangement: settings.arrangement,
      shape: settings.shape,
      ms: state.elapsed,
      errors: state.errors,
      completedAt: Date.now(),
    });
    stats.records = stats.records.slice(0, 5);
    persistStats();
  }

  function orderLabel(order) {
    return order === 'asc' ? '正序' : '倒序';
  }

  function arrangementLabel(arrangement) {
    return arrangement === 'random' ? '随机' : '顺序';
  }

  function shapeLabel(shape) {
    return shape === 'circle' ? '圆形' : '方形';
  }

  function specLabel(settings) {
    return `${settings.size}×${settings.size} ${shapeLabel(settings.shape)} · ${orderLabel(settings.order)} · ${arrangementLabel(settings.arrangement)}`;
  }

  function renderStats() {
    const currentKey = core.specKey(state.settings);
    const best = stats.best[currentKey];
    elements.bestTime.textContent = best === undefined ? '--' : core.formatTime(best);
    const latestForSpec = stats.records.find((record) => record.key === currentKey);
    elements.lastTime.textContent = latestForSpec ? core.formatTime(latestForSpec.ms) : '--';
    elements.lastErrors.textContent = latestForSpec ? latestForSpec.errors : '0';
    renderHistory();
  }

  function renderHistory() {
    elements.historyList.innerHTML = '';
    if (stats.records.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = '还没有训练记录。';
      elements.historyList.append(empty);
      return;
    }

    stats.records.forEach((record) => {
      const item = document.createElement('li');
      item.className = 'history-item';
      const main = document.createElement('strong');
      main.textContent = `${core.formatTime(record.ms)} · ${record.errors} 错`;
      const detail = document.createElement('span');
      detail.textContent = specLabel(record.settings);
      item.append(main, detail);
      elements.historyList.append(item);
    });
  }

  function setSetting(key, value) {
    if (state.phase === 'running') return;
    if (state.phase === 'complete') {
      state.phase = 'idle';
      elements.resultPanel.hidden = true;
    }
    state.settings[key] = key === 'size' ? Number(value) : value;
    state.phase = 'idle';
    state.elapsed = 0;
    state.completed = 0;
    state.errors = 0;
    state.current = firstTarget();
    renderSettings();
    renderBoard();
    updateDisplay();
    renderStats();
  }

  function applyPreset(preset) {
    if (state.phase === 'running') return;
    const presets = {
      beginner: { size: 3, order: 'asc', arrangement: 'random', shape: 'square' },
      standard: { size: 5, order: 'asc', arrangement: 'random', shape: 'square' },
      advanced: { size: 6, order: 'asc', arrangement: 'random', shape: 'circle' },
    };
    state.settings = { ...presets[preset] };
    state.phase = 'idle';
    state.elapsed = 0;
    state.completed = 0;
    state.errors = 0;
    state.current = firstTarget();
    elements.resultPanel.hidden = true;
    renderSettings();
    renderBoard();
    updateDisplay();
    renderStats();
  }

  document.querySelectorAll('[data-setting]').forEach((button) => {
    button.addEventListener('click', () => setSetting(button.dataset.setting, button.dataset.value));
  });

  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  elements.startBtn.addEventListener('click', startGame);
  elements.restartBtn.addEventListener('click', startGame);
  elements.settingsBtn.addEventListener('click', resetToIdle);
  elements.clearBtn.addEventListener('click', () => {
    stats = { best: {}, records: [] };
    localStorage.removeItem(STORAGE_KEY);
    renderStats();
    elements.statusMessage.textContent = '训练记录已清除。';
  });

  state.values = createValues();
  state.current = firstTarget();
  renderSettings();
  renderBoard(state.values);
  updateDisplay();
  renderStats();
})();
