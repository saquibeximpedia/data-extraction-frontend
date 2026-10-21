export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Skeleton({ width = '100%', height = 12, radius = 6 }: { width?: number | string; height?: number; radius?: number }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} />;
}
