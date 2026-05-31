import { Routes, Route } from 'react-router-dom';
import { NovelListPage } from './NovelListPage';
import { HarnessPage } from './HarnessPage';
import { ReaderPage } from './ReaderPage';

export function NovelPage() {
  return (
    <Routes>
      <Route index element={<NovelListPage />} />
      <Route path=":projectId" element={<HarnessPage />} />
      <Route path=":projectId/read" element={<ReaderPage />} />
    </Routes>
  );
}
