function formatDuration(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) {
    return '0m';
  }

  const hours = Math.floor(value / 60);
  const remainderMinutes = value % 60;

  if (hours === 0) {
    return `${remainderMinutes}m`;
  }

  if (remainderMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainderMinutes}m`;
}

function safeText(value) {
  return String(value || '').trim();
}

module.exports = {
  formatDuration,
  safeText,
};
