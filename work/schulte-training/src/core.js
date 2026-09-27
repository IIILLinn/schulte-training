(function (global) {
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildValues(count, random = Math.random) {
    return shuffle(Array.from({ length: count }, (_, index) => index + 1), random);
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pairwiseMinDistance(points) {
    let minimum = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        minimum = Math.min(minimum, distance(points[i], points[j]));
      }
    }
    return Number.isFinite(minimum) ? minimum : 1;
  }

  function selectCandidates(candidates, count, random) {
    const shuffled = shuffle(candidates, random);
    if (shuffled.length <= count) return shuffled;

    const radiusLimit = 0.75;
    const boundary = shuffled.filter((candidate) => candidate.radius >= radiusLimit);
    const boundaryTarget = Math.min(boundary.length, Math.max(4, Math.round(count * 0.24)));
    const selected = boundary.slice(0, boundaryTarget);
    const selectedSet = new Set(selected);

    for (const candidate of shuffled) {
      if (selected.length >= count) break;
      if (!selectedSet.has(candidate)) {
        selected.push(candidate);
        selectedSet.add(candidate);
      }
    }
    return selected;
  }

  function createCircleOutline(radius = 0.45, segments = 64) {
    return Array.from({ length: segments }, (_, index) => {
      const angle = (index / segments) * Math.PI * 2;
      return {
        x: clamp(0.5 + Math.cos(angle) * radius, 0.03, 0.97),
        y: clamp(0.5 + Math.sin(angle) * radius, 0.03, 0.97),
      };
    });
  }

  function createCircularLayout(count, random = Math.random) {
    let gridSize = Math.max(5, Math.ceil(Math.sqrt(count / 0.58)));
    let candidates = [];
    let spacing = 1 / gridSize;

    while (gridSize <= 20) {
      candidates = [];
      spacing = 1 / gridSize;
      const boundaryRadius = 0.455;
      for (let row = 0; row < gridSize; row += 1) {
        for (let column = 0; column < gridSize; column += 1) {
          const x = (column + 0.5) * spacing;
          const y = (row + 0.5) * spacing;
          const radius = Math.hypot(x - 0.5, y - 0.5);
          if (radius <= boundaryRadius - spacing * 0.25) candidates.push({ x, y, radius });
        }
      }
      if (candidates.length >= count + Math.max(4, Math.round(count * 0.12))) break;
      gridSize += 1;
    }

    const selected = selectCandidates(candidates, count, random);
    const jitter = spacing * 0.08;
    const slots = selected.map((candidate) => ({
      x: clamp(candidate.x + (random() - 0.5) * jitter * 2, 0.04, 0.96),
      y: clamp(candidate.y + (random() - 0.5) * jitter * 2, 0.04, 0.96),
    }));
    const actualMin = pairwiseMinDistance(slots);
    return {
      slots: shuffle(slots, random),
      cellRatio: Math.min(0.14, actualMin * 0.78),
      outline: createCircleOutline(),
    };
  }

  function createIrregularLayout(count, random = Math.random) {
    const harmonics = [
      { frequency: 2, amplitude: 0.052 + random() * 0.022, phase: random() * Math.PI * 2 },
      { frequency: 3, amplitude: 0.042 + random() * 0.018, phase: random() * Math.PI * 2 },
      { frequency: 5, amplitude: 0.030 + random() * 0.014, phase: random() * Math.PI * 2 },
      { frequency: 7, amplitude: 0.020 + random() * 0.010, phase: random() * Math.PI * 2 },
    ];

    function boundaryRadius(angle) {
      let radius = 0.34;
      for (const harmonic of harmonics) {
        radius += harmonic.amplitude * Math.sin(harmonic.frequency * angle + harmonic.phase);
      }
      return clamp(radius, 0.20, 0.47);
    }

    const outline = Array.from({ length: 72 }, (_, index) => {
      const angle = (index / 72) * Math.PI * 2;
      const radius = clamp(boundaryRadius(angle) + 0.025, 0.22, 0.48);
      return {
        x: clamp(0.5 + Math.cos(angle) * radius, 0.03, 0.97),
        y: clamp(0.5 + Math.sin(angle) * radius, 0.03, 0.97),
      };
    });

    let gridSize = Math.max(7, Math.ceil(Math.sqrt(count / 0.34)));
    let candidates = [];
    let spacing = 1 / gridSize;

    while (gridSize <= 22) {
      candidates = [];
      spacing = 1 / gridSize;
      for (let row = 0; row < gridSize; row += 1) {
        for (let column = 0; column < gridSize; column += 1) {
          const x = (column + 0.5) * spacing;
          const y = (row + 0.5) * spacing;
          const dx = x - 0.5;
          const dy = y - 0.5;
          const angle = Math.atan2(dy, dx);
          const radius = Math.hypot(dx, dy);
          if (radius <= boundaryRadius(angle) - spacing * 0.25) {
            candidates.push({ x, y, radius });
          }
        }
      }
      if (candidates.length >= count + Math.max(4, Math.round(count * 0.12))) break;
      gridSize += 1;
    }

    const selected = shuffle(candidates, random).slice(0, count);
    const jitter = spacing * 0.06;
    const slots = selected.map((candidate) => ({
      x: clamp(candidate.x + (random() - 0.5) * jitter * 2, 0.03, 0.97),
      y: clamp(candidate.y + (random() - 0.5) * jitter * 2, 0.03, 0.97),
    }));

    return {
      slots: shuffle(slots, random),
      cellRatio: Math.min(0.12, spacing * 0.62),
      outline,
    };
  }

  function objective(values, slots) {
    let minimum = Infinity;
    let total = 0;
    const slotByValue = new Map();
    slots.forEach((slot, index) => slotByValue.set(values[index], slot));
    for (let value = 1; value < values.length; value += 1) {
      const current = distance(slotByValue.get(value), slotByValue.get(value + 1));
      minimum = Math.min(minimum, current);
      total += current;
    }
    return minimum + total * 0.0001;
  }

  function assignValuesToSlots(slots, random = Math.random) {
    const count = slots.length;
    if (count === 0) return [];

    const unvisited = slots.map((_, index) => index);
    const path = [];
    let currentIndex = unvisited.splice(Math.floor(random() * unvisited.length), 1)[0];
    path.push(currentIndex);

    while (unvisited.length > 0) {
      let bestDistance = -Infinity;
      let bestCandidates = [];
      for (const index of unvisited) {
        const currentDistance = distance(slots[currentIndex], slots[index]);
        if (currentDistance > bestDistance + 1e-9) {
          bestDistance = currentDistance;
          bestCandidates = [index];
        } else if (Math.abs(currentDistance - bestDistance) <= 1e-9) {
          bestCandidates.push(index);
        }
      }
      currentIndex = bestCandidates[Math.floor(random() * bestCandidates.length)];
      unvisited.splice(unvisited.indexOf(currentIndex), 1);
      path.push(currentIndex);
    }

    const values = new Array(count);
    path.forEach((slotIndex, valueIndex) => {
      values[slotIndex] = valueIndex + 1;
    });

    let bestScore = objective(values, slots);
    const iterations = count * 260;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const first = Math.floor(random() * count);
      const second = Math.floor(random() * count);
      if (first === second) continue;
      [values[first], values[second]] = [values[second], values[first]];
      const nextScore = objective(values, slots);
      if (nextScore >= bestScore) {
        bestScore = nextScore;
      } else {
        [values[first], values[second]] = [values[second], values[first]];
      }
    }

    return values;
  }

  function createSquareLayout(size) {
    const slots = [];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        slots.push({
          x: (column + 0.5) / size,
          y: (row + 0.5) / size,
        });
      }
    }
    return { slots, cellRatio: 1 / size };
  }

  function specKey(settings) {
    if (settings.shape === 'square') return `square-${settings.squareSize}x${settings.squareSize}`;
    return `${settings.shape}-${settings.count}`;
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, ms) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds * 10) % 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  const api = {
    assignValuesToSlots,
    buildValues,
    createCircularLayout,
    createIrregularLayout,
    createSquareLayout,
    formatTime,
    shuffle,
    specKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SchulteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
