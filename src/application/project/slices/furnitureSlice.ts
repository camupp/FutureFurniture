import { BLOCK_LIMITS, type FurnitureItem } from '@/domain/model'
import { snapElevation } from '@/domain/placement/elevation'
import { findCountertopRow } from '@/domain/assemblies/countertops'
import { roomPolygon } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { placeBlock, placeBlockInSection, placeBlockOnWall } from '@/domain/placement/snapping'
import { placeAtClearance } from '@/domain/placement/clearances'
import { clamp } from '@/shared/lib/units'
import { detachFromWall, furnitureFromWallAnchor } from '@/domain/placement/wallAnchors'
import { clampParams, manualCountertop, autoCountertopRowIds } from '../furnitureHelpers'
import type { AppState, SliceContext } from '../types'

export function createFurnitureSlice({
  set,
  get,
  newId,
}: SliceContext): Pick<
  AppState,
  | 'addBlock'
  | 'addCountertopForRow'
  | 'detachCountertop'
  | 'moveFurniture'
  | 'moveFurnitureAlongWall'
  | 'setFurnitureClearance'
  | 'detachFurniture'
  | 'dropFurniture'
  | 'dropInSection'
  | 'elevateFurniture'
  | 'rotateFurniture'
  | 'updateFurnitureParams'
  | 'removeFurniture'
> {
  return {
    setFurnitureClearance: (id, reference, distance) => {
      const state = get()
      const item = state.furniture.find((candidate) => candidate.id === id)
      if (!item) return 'Блок не найден'
      const result = placeAtClearance(item, reference, distance, state.room, state.furniture)
      if (result.error !== undefined) return result.error
      set({ furniture: state.furniture.map((candidate) => (candidate.id === id ? result.item : candidate)) })
      return null
    },
    addBlock: (block) => {
      const state = get()
      const polygon = roomPolygon(state.room.walls)
      const center = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
      const item: FurnitureItem = {
        id: newId(),
        type: block.type,
        position: center,
        elevation: block.elevation,
        rotation: 0,
        params: clampParams(block.type, block.params),
      }
      set({ furniture: [...state.furniture, item], selection: { kind: 'furniture', id: item.id }, tool: 'select' })
    },

    addCountertopForRow: (cabinetId) =>
      set((state) => {
        const row = findCountertopRow(cabinetId, state.furniture, state.room)
        if (!row.length) return state
        const existing = state.furniture.find(
          (item) => item.type === 'countertop' && item.autoCountertop?.supportIds.includes(cabinetId),
        )
        if (existing) return { selection: { kind: 'furniture', id: existing.id }, tool: 'select' }

        const support = row[0]!
        const item: FurnitureItem = {
          id: newId(),
          type: 'countertop',
          position: support.position,
          rotation: support.rotation,
          elevation: support.elevation + support.params.height,
          params: { width: support.params.width, height: 38, depth: 600, facadeColor: '#8f9299' },
          wallAnchor: support.wallAnchor,
          autoCountertop: { supportIds: row.map((cabinet) => cabinet.id), frontOverhang: 40 },
        }
        return {
          furniture: [...state.furniture, item],
          selection: { kind: 'furniture', id: item.id },
          tool: 'select',
        }
      }),

    detachCountertop: (id) =>
      set((state) => {
        const rowIds = autoCountertopRowIds(id, state.furniture, state.room)
        return { furniture: state.furniture.map((item) => (rowIds.has(item.id) ? manualCountertop(item) : item)) }
      }),

    moveFurniture: (id, position) =>
      set((state) => ({
        furniture: state.furniture.map((item) =>
          item.id === id && !item.autoCountertop ? { ...detachFromWall(item), position } : item,
        ),
      })),

    moveFurnitureAlongWall: (id, offset) =>
      set((state) => {
        const polygon = roomPolygon(state.room.walls)
        const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
        return {
          furniture: state.furniture.map((item) => {
            if (item.id !== id || !item.wallAnchor || item.autoCountertop) return item
            const wall = state.room.walls.find((candidate) => candidate.id === item.wallAnchor?.wallId)
            if (!wall) return detachFromWall(item)
            const placement = placeBlockOnWall(
              item,
              wall.id,
              Math.round(offset),
              state.room,
              state.furniture.filter((candidate) => candidate.id !== id),
              roomCenter,
              false,
            )
            return { ...item, ...placement }
          }),
        }
      }),

    detachFurniture: (id) =>
      set((state) => ({
        furniture: state.furniture.map((item) =>
          item.id === id && !item.autoCountertop ? detachFromWall(item) : item,
        ),
      })),

    dropFurniture: (id, position) =>
      set((state) => {
        const item = state.furniture.find((candidate) => candidate.id === id)
        if (!item || item.autoCountertop) return state
        const polygon = roomPolygon(state.room.walls)
        const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
        const others = state.furniture.filter(
          (candidate) => candidate.id !== id && !candidate.autoCountertop?.supportIds.includes(id),
        )
        const placement = placeBlock(item, position, state.room, others, roomCenter, state.smartPlacement)
        // Блок, переехавший на столешницу, должен врезаться в неё и по высоте.
        const moved = {
          ...item,
          position: placement.position,
          rotation: placement.rotation,
          wallAnchor: placement.wallAnchor,
        }
        const elevation = state.smartPlacement ? snapElevation(moved, item.elevation, others) : item.elevation
        return {
          furniture: state.furniture.map((candidate) => (candidate.id === id ? { ...moved, elevation } : candidate)),
        }
      }),

    dropInSection: (id, x, elevation) =>
      set((state) => {
        const item = state.furniture.find((candidate) => candidate.id === id)
        if (!item || item.autoCountertop) return state
        const wallId = state.elevationWallId ?? item.wallAnchor?.wallId
        if (!wallId) return state
        const polygon = roomPolygon(state.room.walls)
        const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
        const others = state.furniture.filter(
          (candidate) => candidate.id !== id && !candidate.autoCountertop?.supportIds.includes(id),
        )
        const placement = placeBlockInSection(
          item,
          wallId,
          x,
          elevation,
          state.room,
          others,
          roomCenter,
          state.smartPlacement,
        )
        const limited = clamp(placement.elevation, 0, Math.max(0, state.room.wallHeight - item.params.height))
        return {
          furniture: state.furniture.map((candidate) =>
            candidate.id === id
              ? {
                  ...candidate,
                  position: placement.position,
                  rotation: placement.rotation,
                  wallAnchor: placement.wallAnchor,
                  elevation: limited,
                }
              : candidate,
          ),
        }
      }),

    elevateFurniture: (id, elevation) =>
      set((state) => ({
        furniture: state.furniture.map((item) =>
          item.id === id && !item.autoCountertop
            ? {
                ...item,
                elevation: clamp(elevation, 0, Math.max(0, state.room.wallHeight - item.params.height)),
              }
            : item,
        ),
      })),

    rotateFurniture: (id, rotation) =>
      set((state) => ({
        furniture: state.furniture.map((item) =>
          item.id === id && !item.autoCountertop
            ? { ...detachFromWall(item), rotation: ((rotation % 360) + 360) % 360 }
            : item,
        ),
      })),

    updateFurnitureParams: (id, patch) =>
      set((state) => {
        const polygon = roomPolygon(state.room.walls)
        const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
        const automaticIds = autoCountertopRowIds(id, state.furniture, state.room)
        return {
          furniture: state.furniture.map((item) => {
            if (item.id !== id && !automaticIds.has(item.id)) return item
            if (item.autoCountertop) {
              return {
                ...item,
                params: {
                  ...item.params,
                  height: clamp(
                    patch.height ?? item.params.height,
                    BLOCK_LIMITS.countertop.height.min,
                    BLOCK_LIMITS.countertop.height.max,
                  ),
                  facadeColor: patch.facadeColor ?? item.params.facadeColor,
                },
              }
            }
            const resized = { ...item, params: clampParams(item.type, { ...item.params, ...patch }) }
            if (!resized.wallAnchor) return resized
            const wall = state.room.walls.find((candidate) => candidate.id === resized.wallAnchor?.wallId)
            if (!wall) return detachFromWall(resized)

            const footprintChanged =
              resized.params.width !== item.params.width || resized.params.depth !== item.params.depth
            if (!footprintChanged) return furnitureFromWallAnchor(resized, wall)

            const placement = placeBlockOnWall(
              resized,
              wall.id,
              resized.wallAnchor.offset,
              state.room,
              state.furniture.filter(
                (candidate) => candidate.id !== id && !candidate.autoCountertop?.supportIds.includes(id),
              ),
              roomCenter,
              state.smartPlacement,
            )
            return { ...resized, ...placement }
          }),
        }
      }),

    removeFurniture: (id) =>
      set((state) => {
        const rowIds = autoCountertopRowIds(id, state.furniture, state.room)
        return {
          furniture: state.furniture
            .filter((item) => item.id !== id)
            .map((item) => (rowIds.has(item.id) ? manualCountertop(item) : item)),
          selection: state.selection?.id === id ? null : state.selection,
        }
      }),
  }
}
