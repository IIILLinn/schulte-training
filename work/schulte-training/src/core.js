(function (global) {
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildValues(size, order = 'asc', arrangement = 'random', random = Math.random) {
    const total = size * size;
    const values = Array.from({ length: total }, (_, index) => index + 1);
    const ordered = order === 'desc' ? values.reverse() : values;
    return arrangement === 'random' ? shuffle(ordered, random) : ordered;
  }

  function ringCounts(size) {
    if (size % 2 === 1) {
      const rings = Math.floor(size / 2);
      return [1, ...Array.from({ length: rings }, (_, index) => 8 * (index + 1))];
    }
    const rings = size / 2 - 1;
    return [4, ...Array.from({ length: rings }, (_, index) => 12 + index * 8)];
  }

  function clampPosition(value) {
    return Math.min(0.92, Math.max(0.08, value));
  }

  function createCircularSlots(size) {
    const counts = ringCounts(size);
    const slots = [];
    const centerOffset = 0.085;

    if (counts[0] === 1) {
      slots.push({ x: 0.5, y: 0.5 });
    } else {
      slots.push(
        { x: 0.5 - centerOffset, y: 0.5 - centerOffset },
        { x: 0.5 + centerOffset, y: 0.5 - centerOffset },
        { x: 0.5 - centerOffset, y: 0.5 + centerOffset },
        { x: 0.5 + centerOffset, y: 0.5 + centerOffset },
      );
    }

    const ringTotal = counts.length - 1;
    for (let ring = 1; ring <= ringTotal; ring += 1) {
      const radius = ringTotal === 1 ? 0.42 : 0.21 + (ring - 1) * 0.21;
      const count = counts[ring];
      const angleOffset = ring % 2 === 0 ? Math.PI / count : 0;
      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + angleOffset + (index * Math.PI * 2) / count;
        slots.push({
          x: clampPosition(0.5 + Math.cos(angle) * radius),
          y: clampPosition(0.5 + Math.sin(angle) * radius),
        });
      }
    }

    return slots;
  }

  function specKey(settings) {
    return [settings.size, settings.order, settings.arrangement, settings.shape].join('-');
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, ms) / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds * 10) % 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  const api = { buildValues, createCircularSlots, formatTime, shuffle, specKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SchulteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
