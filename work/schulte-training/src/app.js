(function () {
  const core = globalThis.SchulteCore;
  const STORAGE_KEY = 'schulte-training-v1';
  const SQUARE_SIZES = [3, 4, 5, 6, 7];
  const COUNT_SIZES = [15, 20, 25, 30, 35, 40, 45, 50];
  const defaultSettings = {
    shape: 'square',
    squareSize: 5,
    count: 25,
  };

  const elements = {
    board: document.querySelector('#board'),
    settings: document.querySelector('#settings'),
    sizeChoices: document.querySelector('#sizeChoices'),
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
    layout: null,
    total: 25,
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

  function currentTotal() {
    return state.settings.shape === 'square'
      ? state.settings.squareSize * state.settings.squareSize
      : state.settings.count;
  }

  function clearTimer() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    if (state.phase === 'running') state.elapsed = performance.now() - state.startedAt;
  }

  function renderSizeChoices() {
    const isSquare = state.settings.shape === 'square';
    const options = isSquare
      ? SQUARE_SIZES.map((size) => ({ value: size, label: `${size}×${size}` }))
      : COUNT_SIZES.map((count) => ({ value: count, label: String(count) }));
    const selectedValue = isSquare ? state.settings.squareSize : state.settings.count;
    elements.sizeChoices.innerHTML = '';
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.dataset.setting = 'size';
      button.dataset.value = String(option.value);
      button.textContent = option.label;
      button.setAttribute('aria-pressed', String(option.value === selectedValue));
      if (option.value === selectedValue) button.classList.add('is-active');
      elements.sizeChoices.append(button);
    });
  }

  function renderSettings() {
    renderSizeChoices();
    const locked = state.phase === 'running';
    document.querySelectorAll('[data-setting]').forEach((button) => {
      const selected = button.dataset.setting === 'shape'
        ? button.dataset.value === state.settings.shape
        : Number(button.dataset.value) === (state.settings.shape === 'square' ? state.settings.squareSize : state.settings.count);
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = locked;
    });
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.disabled = locked;
    });
  }

  function createLayout(random) {
    if (state.settings.shape === 'square') return core.createSquareLayout(state.settings.squareSize);
    if (state.settings.shape === 'circle') return core.createCircularLayout(state.settings.count, random);
    return core.createIrregularLayout(state.settings.count, random);
  }

  function renderBoard(random = Math.random) {
    const layout = createLayout(random);
    const values = core.assignValuesToSlots(layout.slots, random);
    state.layout = layout;
    state.values = values;
    state.total = values.length;

    elements.board.dataset.shape = state.settings.shape;
    elements.board.style.setProperty('--size', state.settings.shape === 'square' ? state.settings.squareSize : 0);
    elements.board.style.setProperty('--cell-divisor', String(1 / layout.cellRatio));
    elements.board.innerHTML = '';

    values.forEach((value, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.value = String(value);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `数字 ${value}`);
      cell.textContent = value;

      if (state.settings.shape !== 'square') {
        const slot = layout.slots[index];
        cell.style.setProperty('--x', slot.x);
        cell.style.setProperty('--y', slot.y);
        cell.style.setProperty('--scale', (0.86 + random() * 0.14).toFixed(3));
        cell.style.setProperty('--radius', `${(44 + random() * 6).toFixed(1)}%`);
      }

      cell.addEventListener('click', () => handleCellClick(cell, value));
      elements.board.append(cell);
    });
  }

  function setPreviewState() {
    clearTimer();
    state.phase = 'idle';
    state.elapsed = 0;
    state.completed = 0;
    state.errors = 0;
    state.current = 1;
    state.total = currentTotal();
    elements.resultPanel.hidden = true;
    elements.statusMessage.textContent = '准备好后点击“开始训练”。';
  }

  function resetToIdle() {
    setPreviewState();
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
    state.current = 1;
    renderBoard();
    state.startedAt = performance.now();
    state.total = state.values.length;
    elements.resultPanel.hidden = true;
    elements.statusMessage.textContent = `从 1 开始，依次点击到 ${state.total}。`;
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
    const total = state.total || currentTotal();
    elements.timer.textContent = core.formatTime(state.elapsed);
    elements.target.textContent = state.phase === 'complete' ? '完成' : state.current;
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
      window.setTimeout(() => cell.classList.remove('wrong'), 330);
      elements.statusMessage.textContent = `先找 ${state.current}，不要急着跳数字。`;
      updateDisplay();
      return;
    }

    cell.disabled = true;
    cell.classList.add('correct');
    window.setTimeout(() => cell.classList.remove('correct'), 380);
    state.completed += 1;

    if (state.completed >= state.total) {
      state.current = null;
      finishGame();
      return;
    }

    state.current += 1;
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
    if (previousBest === undefined || state.elapsed < previousBest) stats.best[key] = state.elapsed;
    stats.records.unshift({
      key,
      settings,
      ms: state.elapsed,
      errors: state.errors,
      completedAt: Date.now(),
    });
    stats.records = stats.records.slice(0, 5);
    persistStats();
  }

  function shapeLabel(shape) {
    if (shape === 'circle') return '圆形';
    if (shape === 'irregular') return '不规则';
    return '方形';
  }

  function specLabel(settings) {
    if (settings.shape === 'square') return `${settings.squareSize}×${settings.squareSize} 方形`;
    return `${settings.count} 个数字 · ${shapeLabel(settings.shape)}`;
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
    if (key === 'shape') {
      state.settings.shape = value;
      if (value === 'square' && !SQUARE_SIZES.includes(state.settings.squareSize)) state.settings.squareSize = 5;
      if (value !== 'square' && !COUNT_SIZES.includes(state.settings.count)) state.settings.count = 25;
    } else if (key === 'size') {
      if (state.settings.shape === 'square') state.settings.squareSize = Number(value);
      else state.settings.count = Number(value);
    }
    setPreviewState();
    renderSettings();
    renderBoard();
    updateDisplay();
    renderStats();
  }

  function applyPreset(preset) {
    if (state.phase === 'running') return;
    const presets = {
      beginner: { shape: 'square', squareSize: 3, count: 25 },
      standard: { shape: 'square', squareSize: 5, count: 25 },
      chaos: { shape: 'irregular', squareSize: 5, count: 50 },
    };
    state.settings = { ...presets[preset] };
    setPreviewState();
    renderSettings();
    renderBoard();
    updateDisplay();
    renderStats();
  }

  elements.settings.addEventListener('click', (event) => {
    const button = event.target.closest('[data-setting], [data-preset]');
    if (!button) return;
    if (button.dataset.preset) {
      applyPreset(button.dataset.preset);
      return;
    }
    setSetting(button.dataset.setting, button.dataset.value);
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

  state.total = currentTotal();
  renderSettings();
  renderBoard();
  updateDisplay();
  renderStats();
})();
