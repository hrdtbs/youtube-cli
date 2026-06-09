import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { instance as gaxiosInstance } from "gaxios";

const nodeHttpScriptPath = fileURLToPath(
  new URL("./node-http-request.mjs", import.meta.url),
);

type GaxiosLikeOptions = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  body?: unknown;
  responseType?: string;
};

type NodeHttpResponse = {
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  bodyText: string;
};

function isReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as NodeJS.ReadableStream).pipe === "function"
  );
}

function resolveNodeExecutable(): string | null {
  if (process.env.NODE_BIN) {
    return process.env.NODE_BIN;
  }

  if (typeof Bun !== "undefined" && typeof Bun.which === "function") {
    const found = Bun.which("node");
    if (found && !found.toLowerCase().includes("bun")) {
      return found;
    }
  }

  return "node";
}

function createFetchHeaders(headers: Record<string, string>) {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    map.set(key.toLowerCase(), value);
  }

  return {
    get: (name: string) => map.get(name.toLowerCase()) ?? null,
    has: (name: string) => map.has(name.toLowerCase()),
    set: (name: string, value: string) => {
      map.set(name.toLowerCase(), value);
    },
    delete: (name: string) => {
      map.delete(name.toLowerCase());
    },
    append: (name: string, value: string) => {
      const key = name.toLowerCase();
      const existing = map.get(key);
      map.set(key, existing ? `${existing}, ${value}` : value);
    },
    forEach: (
      callback: (value: string, key: string, iterable: unknown) => void,
      thisArg?: unknown,
    ) => {
      map.forEach((value, key) => callback.call(thisArg, value, key, map));
    },
  };
}

function toFetchResponse(parsed: NodeHttpResponse) {
  const headers = createFetchHeaders(parsed.headers);
  const bodyText = parsed.bodyText;

  return {
    status: parsed.status,
    statusText: parsed.statusText,
    url: parsed.url,
    body: null,
    headers,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
    arrayBuffer: async () => new TextEncoder().encode(bodyText).buffer,
    blob: async () => new Blob([bodyText]),
  };
}

function runNodeHttpRequest(
  nodeBin: string,
  payload: GaxiosLikeOptions,
): NodeHttpResponse {
  const result = spawnSync(nodeBin, [nodeHttpScriptPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        "Node HTTP request failed. Set NODE_BIN if Node.js is not on PATH.",
    );
  }

  const line = result.stdout.trim().split("\n").at(-1);
  if (!line) {
    throw new Error("Node HTTP request returned an empty response.");
  }

  return JSON.parse(line) as NodeHttpResponse;
}

async function runNodeHttpStreamRequest(
  nodeBin: string,
  url: string,
  opts: GaxiosLikeOptions,
): Promise<NodeHttpResponse> {
  const body = opts.data ?? opts.body;
  if (!isReadableStream(body)) {
    throw new Error("Expected a readable stream body for streaming HTTP request.");
  }

  return new Promise((resolve, reject) => {
    const config = {
      url: String(url),
      method: opts.method,
      headers: opts.headers,
    };
    const proc = spawn(
      nodeBin,
      [nodeHttpScriptPath, "--stream", JSON.stringify(config)],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              "Node HTTP stream request failed. Set NODE_BIN if Node.js is not on PATH.",
          ),
        );
        return;
      }

      const line = stdout.trim().split("\n").at(-1);
      if (!line) {
        reject(new Error("Node HTTP stream request returned an empty response."));
        return;
      }

      resolve(JSON.parse(line) as NodeHttpResponse);
    });

    body.pipe(proc.stdin);
  });
}

function createNodeFetchImplementation(nodeBin: string) {
  return async (url: string, opts: GaxiosLikeOptions = {}) => {
    const body = opts.data ?? opts.body;
    const parsed = isReadableStream(body)
      ? await runNodeHttpStreamRequest(nodeBin, url, opts)
      : runNodeHttpRequest(nodeBin, {
          url: String(url),
          method: opts.method,
          headers: opts.headers,
          data: body,
        });

    return toFetchResponse(parsed);
  };
}

let configured = false;

export function configureGoogleHttp(): void {
  if (configured) {
    return;
  }
  configured = true;

  const nodeBin = resolveNodeExecutable();
  if (!nodeBin || process.versions.bun === undefined) {
    return;
  }

  const fetchImplementation = createNodeFetchImplementation(nodeBin);
  gaxiosInstance.defaults = {
    ...gaxiosInstance.defaults,
    fetchImplementation,
  };
}

export function getGoogleFetchImplementation():
  | ReturnType<typeof createNodeFetchImplementation>
  | undefined {
  if (process.versions.bun === undefined) {
    return undefined;
  }

  const nodeBin = resolveNodeExecutable();
  if (!nodeBin) {
    return undefined;
  }

  return createNodeFetchImplementation(nodeBin);
}
