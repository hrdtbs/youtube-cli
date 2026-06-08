import { runAuthLogin, runAuthStatus } from "../youtube/auth.js";

export interface AuthLoginOptions {
  clientSecret?: string;
  port?: number;
}

export async function runAuthLoginCommand(
  options: AuthLoginOptions,
): Promise<void> {
  await runAuthLogin({
    clientSecretPath: options.clientSecret,
    port: options.port,
  });
}

export async function runAuthStatusCommand(): Promise<void> {
  await runAuthStatus();
}
