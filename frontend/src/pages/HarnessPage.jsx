import { Navigate, useParams } from 'react-router-dom';

export function HarnessPage() {
  const { projectId } = useParams();
  return <Navigate to={`/novel/${projectId}/workflow`} replace />;
}
