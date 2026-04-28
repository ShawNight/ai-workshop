export function formatSaveTime(lastSavedAt) {
  if (!lastSavedAt) return '';

  const diff = Date.now() - lastSavedAt;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 30) return '刚刚';
  if (seconds < 60) return `${seconds}秒前`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;

  const date = new Date(lastSavedAt);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}