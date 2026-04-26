import { Routes, Route } from 'react-router-dom';
import { NovelListPage } from './NovelListPage';
import { NovelEditorPage } from './NovelEditorPage';
import { ChapterWritePage } from './ChapterWritePage';

export function NovelPage() {
  return (
    <Routes>
      <Route index element={<NovelListPage />} />
      <Route path=":projectId" element={<NovelEditorPage />} />
      <Route path=":projectId/write/:chapterId" element={<ChapterWritePage />} />
    </Routes>
  );
}
