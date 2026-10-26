/** A country's ISO code as a quiet monospace tag, set after its name */
export function CodeTag({ code }: { code: string }) {
  return <span className="code-tag">{code}</span>;
}
