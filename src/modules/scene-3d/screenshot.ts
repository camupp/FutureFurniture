export const sceneCanvas: { current: HTMLCanvasElement | null } = { current: null }

export function downloadSceneScreenshot() {
  const canvas = sceneCanvas.current
  if (!canvas) return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `kuhnya-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`
  link.click()
}
