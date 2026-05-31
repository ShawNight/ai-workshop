export function formatAIContent(text) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      const withBreaks = trimmed.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    })
    .join('');
}

export function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s/g, '');
}

export function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function enrichChaptersFromOutline(project) {
  const outline = project.outline || [];
  const chapters = project.chapters || [];
  const isAutoOutline = outline.length > 0 && outline.some(item => typeof item.chapters === 'number');
  const alreadyEnriched = chapters.length > 0 && chapters[0].volumeIndex !== undefined;
  if (!isAutoOutline || alreadyEnriched || chapters.length === 0) return project;

  let globalIdx = 0;
  const enriched = [...chapters];
  for (let v = 0; v < outline.length; v++) {
    const vol = outline[v];
    for (let c = 0; c < (vol.chapters || 0) && globalIdx < enriched.length; c++) {
      enriched[globalIdx] = {
        ...enriched[globalIdx],
        volumeIndex: v,
        volumeTitle: vol.title || `卷${v + 1}`,
        volumeGoal: vol.goal || '',
        volumeDescription: vol.description || '',
        chapterInVolume: c + 1,
      };
      globalIdx++;
    }
  }
  return { ...project, chapters: enriched };
}