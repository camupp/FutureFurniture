import type { AppState } from './types'

export const selectedFurniture = (state: AppState) =>
  state.selection?.kind === 'furniture'
    ? (state.furniture.find((item) => item.id === state.selection!.id) ?? null)
    : null

export const selectedWall = (state: AppState) =>
  state.selection?.kind === 'wall' ? (state.room.walls.find((wall) => wall.id === state.selection!.id) ?? null) : null

export const selectedOpening = (state: AppState) =>
  state.selection?.kind === 'opening'
    ? (state.room.openings.find((opening) => opening.id === state.selection!.id) ?? null)
    : null

export const selectedUtility = (state: AppState) =>
  state.selection?.kind === 'utility'
    ? (state.room.utilities.find((utility) => utility.id === state.selection!.id) ?? null)
    : null
