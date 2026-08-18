const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Host headers put an IPv6 literal in brackets with the port outside them,
 * e.g. "[::1]:3000" — naively splitting on ":" breaks because the address
 * itself contains colons. Strip brackets first; for anything else, the port
 * (if any) is the only thing after the first ":".
 */
function extractHostname(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host.slice(1) : host.slice(1, end);
  }
  return host.split(":")[0];
}

/**
 * Best-effort check that a request came in on a loopback origin. This is
 * defense-in-depth on top of binding the server to 127.0.0.1 (see the
 * `-H 127.0.0.1` flag on the dev/start scripts) — a Host header can in
 * principle be forged by a raw TCP client on the same box, but the server
 * binding is what actually keeps other machines on the network out.
 */
export function isLocalhostRequest(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  return LOCAL_HOSTNAMES.has(extractHostname(host));
}
