export const mmToM = (mm: number) => mm / 1000

export const degToRad = (deg: number) => (deg * Math.PI) / 180

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const formatMm = (mm: number) => `${Math.round(mm)}`
