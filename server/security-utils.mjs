import { isAbsolute, relative, resolve } from "node:path"

export function isPathInsideDir(filePath, dir) {
  const normalizedFile = resolve(filePath)
  const normalizedDir = resolve(dir)
  const pathFromDir = relative(normalizedDir, normalizedFile)
  return pathFromDir === "" || (!pathFromDir.startsWith("..") && !isAbsolute(pathFromDir))
}
