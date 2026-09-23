import { selectedFurniture, selectedOpening, selectedUtility, selectedWall, useAppStore } from '@/application/project'
import { OpeningProperties } from './forms/OpeningProperties'
import { UtilityProperties } from './forms/UtilityProperties'
import { RoomProperties } from './forms/RoomProperties'
import { WallProperties } from './forms/WallProperties'
import { BlockProperties } from './forms/BlockProperties'

export function PropertiesPanel() {
  const wall = useAppStore(selectedWall)
  const item = useAppStore(selectedFurniture)
  const opening = useAppStore(selectedOpening)
  const utility = useAppStore(selectedUtility)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Свойства</h2>
      {opening ? (
        <OpeningProperties />
      ) : utility ? (
        <UtilityProperties />
      ) : wall ? (
        <WallProperties />
      ) : item ? (
        <BlockProperties />
      ) : (
        <RoomProperties />
      )}
    </aside>
  )
}
