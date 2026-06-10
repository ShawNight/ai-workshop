import { Routes, Route } from 'react-router-dom';
import { NovelListPage } from './NovelListPage';
import { ProjectOverviewPage } from './ProjectOverviewPage';
import { WorkflowPage } from './WorkflowPage';
import { BlueprintPage } from './BlueprintPage';
import { ReaderPage } from './ReaderPage';
import { ChapterEditorPage } from './ChapterEditorPage';

export function NovelPage() {
  return (
    <Routes>
      <Route index element={<NovelListPage />} />
      <Route path=":projectId" element={<ProjectOverviewPage />} />
      <Route path=":projectId/workflow" element={<WorkflowPage />} />
      <Route path=":projectId/blueprint" element={<BlueprintPage />} />
      <Route path=":projectId/read" element={<ReaderPage />} />
      <Route path=":projectId/read/:chapterIdx" element={<ChapterEditorPage />} />
    </Routes>
  );
}
