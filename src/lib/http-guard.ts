const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Best-effort check that a request came in on a loopback origin. This is
 * defense-in-depth on top of binding the server to 127.0.0.1 (see the
 * `-H 127.0.0.1` flag on the dev/start scripts) — a Host header can in
 * principle be forged by a raw TCP client on the same box, but the server
 * binding is what actually keeps other machines on the network out.
 */
export function isLocalhostRequest(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  return LOCAL_HOSTNAMES.has(hostname);
}
