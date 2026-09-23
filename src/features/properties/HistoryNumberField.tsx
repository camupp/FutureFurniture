import type { ComponentProps } from 'react'
import { useAppStore } from '@/application/project'
import { NumberField } from '@/shared/ui/NumberField'

/** One slider gesture is one project edit, including its derived geometry. */
export function HistoryNumberField(props: ComponentProps<typeof NumberField>) {
  const begin = useAppStore((state) => state.beginHistoryGroup)
  const end = useAppStore((state) => state.endHistoryGroup)
  return <NumberField {...props} onInteractionStart={begin} onInteractionEnd={end} />
}
