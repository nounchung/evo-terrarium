export function hslToNumber(hue: number, saturation: number, lightness: number): number {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const section = (((hue % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  let red = 0
  let green = 0
  let blue = 0
  if (section < 1) [red, green] = [chroma, x]
  else if (section < 2) [red, green] = [x, chroma]
  else if (section < 3) [green, blue] = [chroma, x]
  else if (section < 4) [green, blue] = [x, chroma]
  else if (section < 5) [red, blue] = [x, chroma]
  else [red, blue] = [chroma, x]
  const match = l - chroma / 2
  return (
    (Math.round((red + match) * 255) << 16)
    | (Math.round((green + match) * 255) << 8)
    | Math.round((blue + match) * 255)
  )
}

export function geneRatio(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}
