import { useSyncExternalStore } from 'react'
import { projectSession } from '@/application/project'

export function useProjectSession() {
  return useSyncExternalStore(projectSession.subscribe, projectSession.getSnapshot, projectSession.getSnapshot)
}
