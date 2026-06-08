import { createServer } from "node:http";
import { URL } from "node:url";

export interface OAuthCallbackResult {
  code: string;
  redirectUri: string;
}

export interface OAuthServerHandle {
  port: number;
  waitForCode: () => Promise<OAuthCallbackResult>;
  close: () => void;
}

export function startOAuthServer(
  requestedPort = 0,
  timeoutMs = 120_000,
): Promise<OAuthServerHandle> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let waitResolve: ((value: OAuthCallbackResult) => void) | null = null;
    let waitReject: ((reason?: unknown) => void) | null = null;

    const server = createServer((req, res) => {
      try {
        const address = server.address();
        const port =
          typeof address === "object" && address ? address.port : requestedPort;
        const host = req.headers.host ?? `127.0.0.1:${port}`;
        const url = new URL(req.url ?? "/", `http://${host}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Authorization failed: ${error}`);
          waitReject?.(new Error(`OAuth authorization failed: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Missing authorization code.");
          waitReject?.(
            new Error("OAuth callback did not include an authorization code."),
          );
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><p>Authorization complete. You can close this window and return to the terminal.</p></body></html>",
        );

        waitResolve?.({
          code,
          redirectUri: `http://127.0.0.1:${port}/`,
        });
      } catch (error) {
        waitReject?.(error);
      }
    });

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      server.close();
      waitReject?.(
        new Error("OAuth callback timed out. Try running auth login again."),
      );
    }, timeoutMs);

    server.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    server.listen(requestedPort, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : requestedPort;

      resolve({
        port,
        waitForCode: () =>
          new Promise<OAuthCallbackResult>((resolveCode, rejectCode) => {
            waitResolve = (result) => {
              settled = true;
              clearTimeout(timer);
              server.close();
              resolveCode(result);
            };
            waitReject = (reason) => {
              settled = true;
              clearTimeout(timer);
              server.close();
              rejectCode(reason);
            };
          }),
        close: () => {
          settled = true;
          clearTimeout(timer);
          server.close();
        },
      });
    });
  });
}

export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command =
    platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : platform === "darwin"
        ? ["open", url]
        : ["xdg-open", url];

  const proc = Bun.spawn(command, {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
}
