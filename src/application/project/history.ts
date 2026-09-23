import type { Project } from '@/domain/model'

/** Only document data: selection, camera and editor preferences are not undoable. */
export type ProjectSnapshot = Pick<Project, 'room' | 'furniture'>

export type ProjectHistory = {
  past: ProjectSnapshot[]
  future: ProjectSnapshot[]
  group: { before: ProjectSnapshot; future: ProjectSnapshot[]; changed: boolean } | null
}

export const HISTORY_LIMIT = 100

export function emptyHistory(): ProjectHistory {
  return { past: [], future: [], group: null }
}

export function projectSnapshot(project: ProjectSnapshot): ProjectSnapshot {
  // Store actions replace objects instead of mutating them, so snapshots share unchanged data.
  return { room: project.room, furniture: project.furniture }
}

function sameProject(a: ProjectSnapshot, b: ProjectSnapshot): boolean {
  if (a.room === b.room && a.furniture === b.furniture) return true
  // Some actions create new objects even when the effective value did not change.
  return JSON.stringify(projectSnapshot(a)) === JSON.stringify(projectSnapshot(b))
}

const append = (past: ProjectSnapshot[], snapshot: ProjectSnapshot) => [...past, snapshot].slice(-HISTORY_LIMIT)

export function recordProjectChange(
  history: ProjectHistory,
  before: ProjectSnapshot,
  after: ProjectSnapshot,
): ProjectHistory {
  if (sameProject(before, after)) return history
  if (history.group) {
    const changed = !sameProject(history.group.before, after)
    return {
      ...history,
      future: changed ? [] : history.group.future,
      group: { ...history.group, changed },
    }
  }
  return { past: append(history.past, projectSnapshot(before)), future: [], group: null }
}

export function startHistoryGroup(history: ProjectHistory, project: ProjectSnapshot): ProjectHistory {
  if (history.group) return history
  return { ...history, group: { before: projectSnapshot(project), future: history.future, changed: false } }
}

export function finishHistoryGroup(history: ProjectHistory): ProjectHistory {
  if (!history.group) return history
  return {
    past: history.group.changed ? append(history.past, history.group.before) : history.past,
    future: history.group.changed ? [] : history.group.future,
    group: null,
  }
}

export const canUndo = ({ history }: { history: ProjectHistory }): boolean =>
  history.past.length > 0 || Boolean(history.group?.changed)

export const canRedo = ({ history }: { history: ProjectHistory }): boolean => history.future.length > 0

export function travelHistory(history: ProjectHistory, current: ProjectSnapshot, direction: 'undo' | 'redo') {
  const closed = finishHistoryGroup(history)
  const source = direction === 'undo' ? closed.past : closed.future
  const project = source.at(-1)
  if (!project) return { project: current, history: closed }
  return {
    project,
    history: {
      past: direction === 'undo' ? closed.past.slice(0, -1) : append(closed.past, projectSnapshot(current)),
      future: direction === 'undo' ? [...closed.future, projectSnapshot(current)] : closed.future.slice(0, -1),
      group: null,
    } satisfies ProjectHistory,
  }
}
