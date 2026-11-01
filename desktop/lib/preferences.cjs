'use strict';

const WINDOW_SIZES = Object.freeze({
  small: Object.freeze({ width: 220, height: 360 }),
  medium: Object.freeze({ width: 300, height: 480 }),
  large: Object.freeze({ width: 380, height: 600 })
});

function normalizePreferences(input) {
  const value = input && typeof input === 'object' ? input : {};
  const position = value.position && Number.isFinite(value.position.x) && Number.isFinite(value.position.y)
    ? { x: Math.round(value.position.x), y: Math.round(value.position.y) }
    : null;
  return {
    pose: value.pose === 'standing' ? 'standing' : 'sitting',
    size: typeof value.size === 'string' && Object.hasOwn(WINDOW_SIZES, value.size) ? value.size : 'medium',
    alwaysOnTop: value.alwaysOnTop !== false,
    quietMode: value.quietMode === true,
    lockPosition: value.lockPosition === true,
    position,
    shortcutCreated: value.shortcutCreated === true
  };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

// Clamp restored positions after a monitor is removed or its work area changes.
function fitWindow(size, position, workAreas) {
  const areas = workAreas.filter(area => ['x', 'y', 'width', 'height'].every(key => Number.isFinite(area[key])) && area.width > 0 && area.height > 0);
  if (!areas.length) throw new Error('No usable display work area.');
  const restored = position && Number.isFinite(position.x) && Number.isFinite(position.y);
  let area = areas[0];
  if (restored) {
    const desired = { ...size, ...position };
    const rank = candidate => ({
      area: candidate,
      overlap: overlap(desired, candidate),
      distance: Math.hypot(position.x + size.width / 2 - candidate.x - candidate.width / 2, position.y + size.height / 2 - candidate.y - candidate.height / 2)
    });
    area = areas.map(rank).sort((a, b) => b.overlap - a.overlap || a.distance - b.distance)[0].area;
  }
  const width = Math.max(1, Math.min(size.width, area.width));
  const height = Math.max(1, Math.min(size.height, area.height));
  return {
    x: Math.round(Math.max(area.x, Math.min(restored ? position.x : area.x + area.width - width - 24, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(restored ? position.y : area.y + area.height - height - 24, area.y + area.height - height))),
    width: Math.round(width),
    height: Math.round(height)
  };
}

module.exports = { WINDOW_SIZES, normalizePreferences, fitWindow };
