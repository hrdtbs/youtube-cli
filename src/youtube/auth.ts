import { mkdir, readFile, writeFile } from "node:fs/promises";
import { google } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import {
  getConfigDir,
  getTokenPath,
  resolveClientSecretPath,
  YOUTUBE_SCOPES,
} from "../lib/config.js";
import { openBrowser, startOAuthServer } from "../lib/oauth-server.js";
import type { ClientSecretFile, TokenFile } from "./types.js";

function sanitizeToken(token: TokenFile): Credentials {
  return {
    access_token: token.access_token ?? undefined,
    refresh_token: token.refresh_token ?? undefined,
    scope: token.scope ?? undefined,
    token_type: token.token_type ?? undefined,
    expiry_date: token.expiry_date ?? undefined,
  };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export async function loadClientSecretFile(
  path: string,
): Promise<OAuthClientConfig> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AuthError(
        `OAuth client secret file not found: ${path}\nDownload it from Google Cloud Console (Desktop OAuth client).`,
      );
    }
    throw error;
  }

  const data = JSON.parse(raw) as ClientSecretFile;
  const source = data.installed ?? data.web;
  if (!source?.client_id || !source.client_secret) {
    throw new AuthError(
      `Invalid client secret file: ${path}\nExpected installed or web OAuth credentials.`,
    );
  }

  return {
    clientId: source.client_id,
    clientSecret: source.client_secret,
  };
}

function createOAuth2Client(
  config: OAuthClientConfig,
  redirectUri: string,
): OAuth2Client {
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    redirectUri,
  );
}

export async function loadTokenFile(): Promise<TokenFile | null> {
  try {
    const raw = await readFile(getTokenPath(), "utf8");
    return JSON.parse(raw) as TokenFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveTokenFile(tokens: TokenFile): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getTokenPath(), JSON.stringify(tokens, null, 2), "utf8");
}

export async function runAuthLogin(options: {
  clientSecretPath?: string;
  port?: number;
}): Promise<void> {
  const clientSecretPath = resolveClientSecretPath(options.clientSecretPath);
  const config = await loadClientSecretFile(clientSecretPath);
  const oauthServer = await startOAuthServer(options.port ?? 0);
  const redirectUri = `http://127.0.0.1:${oauthServer.port}/`;
  const oauth2Client = createOAuth2Client(config, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    // select_account is required for Google's Brand Account channel picker.
    prompt: "consent select_account",
    scope: YOUTUBE_SCOPES,
  });

  console.log("Opening browser for Google authorization...");
  console.log(
    "If you manage a Brand Account, choose your Google account, then pick the Brand Account channel on the next screen.",
  );
  console.log(
    "If the channel picker does not appear, revoke this app at https://myaccount.google.com/permissions and run auth login again.",
  );
  console.log(`If the browser does not open, visit:\n${authUrl}\n`);

  try {
    await openBrowser(authUrl);
  } catch {
    console.log("Could not open browser automatically.");
  }

  const { code, redirectUri: callbackRedirect } = await oauthServer.waitForCode();
  const exchangeClient = createOAuth2Client(config, callbackRedirect);
  const { tokens } = await exchangeClient.getToken(code);

  if (!tokens.refresh_token) {
    throw new AuthError(
      "No refresh token received. Revoke app access in Google Account settings and run auth login again with prompt=consent.",
    );
  }

  await saveTokenFile(tokens as TokenFile);

  const verifyClient = await getAuthorizedClient(clientSecretPath);
  const channels = await fetchMyChannels(verifyClient);
  console.log("Authentication saved successfully.");
  console.log(`Token file: ${getTokenPath()}`);
  printChannels(channels);
}

export interface AuthenticatedChannel {
  id: string;
  title: string;
}

export async function fetchMyChannels(
  client: OAuth2Client,
): Promise<AuthenticatedChannel[]> {
  const youtube = google.youtube({ version: "v3", auth: client });
  const response = await youtube.channels.list({
    part: ["snippet"],
    mine: true,
  });

  return (response.data.items ?? [])
    .filter((item) => item.id && item.snippet?.title)
    .map((item) => ({
      id: item.id!,
      title: item.snippet!.title!,
    }));
}

function printChannels(channels: AuthenticatedChannel[]): void {
  if (channels.length === 0) {
    console.log("Channel: (none returned by API)");
    return;
  }

  for (const channel of channels) {
    console.log(`Channel: ${channel.title} (${channel.id})`);
  }
}

export async function runAuthChannels(): Promise<void> {
  const client = await getAuthorizedClient();
  const channels = await fetchMyChannels(client);

  if (channels.length === 0) {
    console.log("No channel associated with the current token.");
    console.log(
      "Run auth login again and select your Brand Account on the channel picker screen.",
    );
    return;
  }

  console.log("Authenticated channel(s):");
  printChannels(channels);
}

export async function getAuthorizedClient(
  clientSecretPath?: string,
): Promise<OAuth2Client> {
  const secretPath = resolveClientSecretPath(clientSecretPath);
  const config = await loadClientSecretFile(secretPath);
  const token = await loadTokenFile();

  if (!token?.refresh_token) {
    throw new AuthError(
      `Not authenticated. Run: youtube auth login --client-secret ${secretPath}`,
    );
  }

  const oauth2Client = createOAuth2Client(
    config,
    "http://127.0.0.1",
  );
  oauth2Client.setCredentials(sanitizeToken(token));

  oauth2Client.on("tokens", async (newTokens) => {
    const merged: TokenFile = {
      ...token,
      ...newTokens,
      refresh_token: newTokens.refresh_token ?? token.refresh_token,
    };
    await saveTokenFile(merged);
  });

  return oauth2Client;
}

export async function runAuthStatus(): Promise<void> {
  const tokenPath = getTokenPath();
  const token = await loadTokenFile();

  if (!token) {
    console.log("Not authenticated.");
    console.log(`Token file: ${tokenPath} (missing)`);
    console.log("Run: youtube auth login --client-secret ./client_secret.json");
    return;
  }

  console.log(`Token file: ${tokenPath}`);

  if (token.expiry_date) {
    const expires = new Date(token.expiry_date);
    console.log(`Access token expires: ${expires.toISOString()}`);
  }

  console.log(`Refresh token: ${token.refresh_token ? "present" : "missing"}`);

  try {
    const client = await getAuthorizedClient();
    const channels = await fetchMyChannels(client);
    if (channels.length === 0) {
      console.log("Status: authenticated (no channel returned)");
      return;
    }

    const label = channels.map((c) => `${c.title} (${c.id})`).join(", ");
    console.log(`Status: authenticated (${label})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Status: invalid (${message})`);
    process.exitCode = 2;
  }
}
