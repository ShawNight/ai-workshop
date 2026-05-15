/**
 * LRC 歌词时间戳校准工具函数
 */

/**
 * 解析 LRC 时间戳为秒数
 * @param {string} timestamp - 如 "01:23.45" 或 "01:23.456"
 * @returns {number} 秒数
 */
export function parseLrcTime(timestamp) {
  const match = timestamp.match(/^(\d{2}):(\d{2})\.(\d{2,3})$/);
  if (!match) return 0;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  const ms = parseInt(match[3].padEnd(3, '0'), 10);
  return mins * 60 + secs + ms / 1000;
}

/**
 * 将秒数格式化为 LRC 时间戳
 * @param {number} seconds
 * @returns {string} 如 "01:23.45"
 */
export function formatTimeToLrc(seconds) {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const cs = Math.round((clamped % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * 将偏移量叠加到原始 LRC 上，生成新的 LRC 字符串
 * @param {string} originalLrc - 原始 LRC 文本
 * @param {number} globalOffset - 全局偏移（毫秒）
 * @param {object} lrcOffsets - 逐行偏移映射 { lineIndex: offsetMs }
 * @returns {string} 叠加后的 LRC 文本
 */
export function applyLrcOffsets(originalLrc, globalOffset = 0, lrcOffsets = {}) {
  if (!originalLrc) return '';

  const lines = originalLrc.trim().split('\n');
  const totalGlobalOffset = globalOffset / 1000;

  return lines.map((line, index) => {
    const match = line.match(/^(\[\d{2}:\d{2}\.\d{2,3}\])(.*)/);
    if (!match) return line;

    const timestamp = match[1];
    const text = match[2];
    const originalTime = parseLrcTime(timestamp.slice(1, -1));
    const lineOffset = (lrcOffsets[index] || 0) / 1000;
    const newTime = Math.max(0, originalTime + totalGlobalOffset + lineOffset);

    return `[${formatTimeToLrc(newTime)}]${text}`;
  }).join('\n');
}

/**
 * 解析 LRC 文本为带时间戳的行数组（支持偏移叠加）
 * @param {string} lrcText
 * @param {number} globalOffset - 全局偏移（毫秒）
 * @param {object} lrcOffsets - 逐行偏移映射
 * @returns {Array<{time: number, text: string}>} 时间戳行数组
 */
export function parseLrcWithOffsets(lrcText, globalOffset = 0, lrcOffsets = {}) {
  if (!lrcText) return [];

  const lines = lrcText.trim().split('\n');
  const totalGlobalOffset = globalOffset / 1000;
  const timedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
    if (!match) continue;

    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
    const originalTime = mins * 60 + secs + ms / 1000;
    const lineOffset = (lrcOffsets[i] || 0) / 1000;
    const time = Math.max(0, originalTime + totalGlobalOffset + lineOffset);
    const text = match[4].trim();

    if (text) {
      timedLines.push({ time, text, originalIndex: i });
    }
  }

  // 计算每行时长
  for (let i = 0; i < timedLines.length; i++) {
    const nextTime = i + 1 < timedLines.length ? timedLines[i + 1].time : timedLines[i].time + 3;
    timedLines[i].duration = nextTime - timedLines[i].time;
  }

  return timedLines;
}
