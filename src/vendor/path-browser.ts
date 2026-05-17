export function join(...parts: string[]): string {
  const [first = "", ...rest] = parts;
  const joined = [first.replace(/\/+$/g, ""), ...rest.map((part) => part.replace(/^\/+|\/+$/g, ""))]
    .filter((part, index) => index === 0 || part.length > 0)
    .join("/");

  return first.startsWith("/") ? `/${joined.replace(/^\/+/g, "")}` : joined;
}

export default { join };
