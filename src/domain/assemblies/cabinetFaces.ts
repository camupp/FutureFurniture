import type { CabinetModuleConfig } from '@/domain/modules/cabinetFamilies'
import type { CabinetFrontInterval } from './cabinetJoints'

export const CABINET_FACADE_GAP = 3
export const CABINET_PLINTH_HEIGHT = 100
const HANDLE_LENGTH = 128

export type CabinetFacePanel = {
  kind: 'door' | 'drawer' | 'lift' | 'oven' | 'dishwasher' | 'fridge'
  left: number
  right: number
  bottom: number
  top: number
  handleX: number
  handleY: number
  handleOrientation: 'vertical' | 'horizontal'
  handleStyle: 'bar' | 'knob'
  handleWidth: number
  handleHeight: number
}

/** One renderer-independent facade layout for base, wall and tall cabinets. All coordinates are local millimetres. */
export function cabinetFacePanels(
  width: number,
  height: number,
  onFloor: boolean,
  visible: CabinetFrontInterval[] | undefined,
  module: CabinetModuleConfig,
): CabinetFacePanel[] {
  const gap = CABINET_FACADE_GAP
  const plinth = onFloor ? CABINET_PLINTH_HEIGHT : 0
  const panelHeight = height - plinth - 2 * gap
  const handleStyle = module.handleStyle ?? 'bar'

  const panel = (
    kind: CabinetFacePanel['kind'],
    left: number,
    right: number,
    bottom: number,
    top: number,
    handleX: number,
    handleY: number,
    handleOrientation: CabinetFacePanel['handleOrientation'],
  ): CabinetFacePanel => ({
    kind,
    left,
    right,
    bottom,
    top,
    handleX,
    handleY,
    handleOrientation,
    handleStyle,
    handleWidth:
      handleStyle === 'knob'
        ? 32
        : handleOrientation === 'horizontal'
          ? Math.max(30, Math.min(HANDLE_LENGTH, right - left - 80))
          : 16,
    handleHeight: handleStyle === 'knob' ? 32 : handleOrientation === 'vertical' ? HANDLE_LENGTH : 16,
  })

  return (visible ?? fullCabinetFront(width)).flatMap((interval) => {
    const intervalWidth = interval.end - interval.start
    if (intervalWidth <= 2 * gap) return []
    const left = interval.start + gap
    const right = interval.end - gap
    const bottom = plinth + gap
    const top = height - gap
    const sideHandleX = (start: number, end: number, side: 'left' | 'right') =>
      side === 'left' ? start + 40 : end - 40

    if (module.familyId === 'base-storage' && module.role === 'oven') {
      return [panel('oven', left, right, bottom, top, (left + right) / 2, top - 65, 'horizontal')]
    }
    if (module.familyId === 'base-storage' && module.role === 'dishwasher') {
      return [panel('dishwasher', left, right, bottom, top, (left + right) / 2, top - 45, 'horizontal')]
    }
    if (module.familyId === 'tall-storage' && module.role === 'oven') {
      const ovenBottom = Math.min(height - 750, Math.max(bottom + 450, 850))
      const ovenTop = Math.min(top - 300, ovenBottom + 600)
      const handleX = sideHandleX(left, right, module.handleSide ?? 'right')
      return [
        panel('door', left, right, bottom, ovenBottom - gap, handleX, ovenBottom - 140, 'vertical'),
        panel('oven', left, right, ovenBottom, ovenTop, (left + right) / 2, ovenTop - 65, 'horizontal'),
        panel('door', left, right, ovenTop + gap, top, handleX, ovenTop + 140, 'vertical'),
      ]
    }
    if (module.familyId === 'tall-storage' && module.role === 'fridge') {
      const seam = bottom + Math.round((panelHeight * 0.3) / 10) * 10
      const handleX = sideHandleX(left, right, module.handleSide ?? 'right')
      return [
        panel('fridge', left, right, bottom, seam, handleX, seam - 110, 'vertical'),
        panel('fridge', left, right, seam + gap, top, handleX, seam + 110, 'vertical'),
      ]
    }

    if (module.facade === 'three-drawers') {
      const drawerHeight = (panelHeight - 2 * gap) / 3
      return Array.from({ length: 3 }, (_, index) => {
        const rowBottom = bottom + index * (drawerHeight + gap)
        const rowTop = rowBottom + drawerHeight
        return panel('drawer', left, right, rowBottom, rowTop, (left + right) / 2, rowTop - 45, 'horizontal')
      })
    }

    if (module.facade === 'lift-up') {
      return [panel('lift', left, right, bottom, top, (left + right) / 2, bottom + 70, 'horizontal')]
    }

    if (module.facade === 'stacked-doors') {
      const lowerHeight = Math.round(((panelHeight - gap) * 0.6) / 10) * 10
      const seam = bottom + lowerHeight
      const handleX = sideHandleX(left, right, module.handleSide ?? 'right')
      return [
        panel('door', left, right, bottom, seam, handleX, seam - 100, 'vertical'),
        panel('door', left, right, seam + gap, top, handleX, seam + gap + 100, 'vertical'),
      ]
    }

    const doorCount = module.facade === 'double-door' ? 2 : 1
    const doorWidth = (intervalWidth - gap * (doorCount + 1)) / doorCount
    return Array.from({ length: doorCount }, (_, index) => {
      const start = interval.start + gap + index * (doorWidth + gap)
      const end = start + doorWidth
      const side = doorCount === 1 ? (module.handleSide ?? 'right') : index === 0 ? 'right' : 'left'
      const handleY =
        module.facade === 'full-door' ? Math.min(height - 120, 1100) : onFloor ? height - 120 : plinth + 120
      return panel('door', start, end, bottom, top, sideHandleX(start, end, side), handleY, 'vertical')
    })
  })
}

export function fullCabinetFront(width: number): CabinetFrontInterval[] {
  return [{ start: -width / 2, end: width / 2 }]
}
