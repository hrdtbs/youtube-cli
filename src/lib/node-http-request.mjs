#!/usr/bin/env node
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { URL } from "node:url";

function isReadableStream(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.pipe === "function"
  );
}

function readAllStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

function readLine(stream) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }
      stream.off("data", onData);
      stream.off("error", onError);
      resolve(buffer.slice(0, newline));
    };
    const onError = (error) => {
      stream.off("data", onData);
      stream.off("error", onError);
      reject(error);
    };
    stream.on("data", onData);
    stream.on("error", onError);
    if (stream.readableEnded) {
      resolve(buffer);
    }
  });
}

function decodeResponseBody(buffer, contentEncoding) {
  if (!contentEncoding) {
    return buffer;
  }

  const encoding = contentEncoding.toLowerCase().split(",")[0].trim();
  if (encoding === "gzip" || encoding === "x-gzip") {
    return gunzipSync(buffer);
  }
  if (encoding === "deflate") {
    return inflateSync(buffer);
  }
  if (encoding === "br") {
    return brotliDecompressSync(buffer);
  }

  return buffer;
}

function performRequest(config, body) {
  const url = new URL(config.url);
  const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;
  const method = config.method || "GET";
  const headers = { ...(config.headers || {}) };

  return new Promise((resolve, reject) => {
    const req = requestFn(
      url,
      {
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const rawBody = Buffer.concat(chunks);
          const decodedBody = decodeResponseBody(
            rawBody,
            res.headers["content-encoding"],
          );
          const bodyText = decodedBody.toString("utf8");
          const outHeaders = {};
          for (const [key, value] of Object.entries(res.headers)) {
            outHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
          }
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage || "",
            url: config.url,
            headers: outHeaders,
            bodyText,
          });
        });
      },
    );

    req.on("error", reject);

    if (body) {
      if (isReadableStream(body)) {
        body.pipe(req);
      } else if (Buffer.isBuffer(body)) {
        req.end(body);
      } else {
        req.end(String(body));
      }
      return;
    }

    req.end();
  });
}

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function runJsonMode(rawInput) {
  const input = JSON.parse(rawInput.toString("utf8"));
  const body = input.data ?? input.body;
  const response = await performRequest(input, body);
  writeResponse(response);
}

async function runStreamMode() {
  const configLine = await readLine(process.stdin);
  const config = JSON.parse(configLine);
  const response = await performRequest(config, process.stdin);
  writeResponse(response);
}

async function main() {
  try {
    if (process.argv.includes("--stream")) {
      await runStreamMode();
      return;
    }

    const rawInput = await readAllStdin();
    if (rawInput.length === 0) {
      throw new Error("Expected HTTP request JSON on stdin.");
    }
    await runJsonMode(rawInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(message);
    process.exit(1);
  }
}

await main();
