#!/usr/bin/env bun

import { Command } from "commander";
import {
  runAuthChannelsCommand,
  runAuthLoginCommand,
  runAuthStatusCommand,
} from "./commands/auth.js";
import { runCategoriesList } from "./commands/categories.js";
import { runUpload } from "./commands/upload.js";
import { CLI_NAME } from "./lib/config.js";
import { configureGoogleHttp } from "./lib/google-http.js";
import { AuthError } from "./youtube/auth.js";

configureGoogleHttp();

const program = new Command();

program
  .name(CLI_NAME)
  .description("Batch upload videos to YouTube with scheduled publishing")
  .version("0.1.0")
  .showHelpAfterError("(use `youtube --help` for usage)");

const authCmd = program.command("auth").description("Authentication commands");

authCmd
  .command("login")
  .description("Authorize with Google via browser (saves token.json)")
  .option(
    "--client-secret <path>",
    "OAuth client JSON from Google Cloud",
    "./client_secret.json",
  )
  .option("--port <number>", "loopback port (0 = auto)", "0")
  .action(async (options) => {
    try {
      await runAuthLoginCommand({
        clientSecret: options.clientSecret,
        port: Number.parseInt(options.port, 10),
      });
    } catch (error) {
      reportError(error);
    }
  });

authCmd
  .command("status")
  .description("Show authentication status")
  .action(async () => {
    try {
      await runAuthStatusCommand();
    } catch (error) {
      reportError(error);
    }
  });

authCmd
  .command("channels")
  .description("Show the YouTube channel tied to the current OAuth token")
  .action(async () => {
    try {
      await runAuthChannelsCommand();
    } catch (error) {
      reportError(error);
    }
  });

const categoriesCmd = program
  .command("categories")
  .description("YouTube video category commands");

categoriesCmd
  .command("list")
  .description("List video category IDs for config.yaml (videoCategories.list)")
  .option("--region <code>", "ISO 3166-1 alpha-2 region code", "JP")
  .option("--hl <lang>", "language for category titles", "ja")
  .option("--all", "include categories not assignable to uploads", false)
  .action(async (options) => {
    try {
      await runCategoriesList({
        region: options.region,
        hl: options.hl,
        all: options.all,
      });
    } catch (error) {
      reportError(error);
    }
  });

program
  .command("upload")
  .description("Upload videos from a folder with scheduled publishing")
  .option("--dir <path>", "video directory", process.env.YOUTUBE_UPLOAD_DIR)
  .option("--config <path>", "config.yaml path")
  .option("--dry-run", "preview metadata and schedule without uploading", false)
  .option("--delay <seconds>", "delay between uploads", "10")
  .option("--recursive", "scan subdirectories", false)
  .option("--force", "re-upload indexed files", false)
  .action(async (options) => {
    try {
      await runUpload({
        dir: options.dir,
        config: options.config,
        dryRun: options.dryRun,
        delay: Number.parseFloat(options.delay),
        recursive: options.recursive,
        force: options.force,
      });
    } catch (error) {
      reportError(error);
    }
  });

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);

  if (error instanceof AuthError) {
    process.exitCode = 2;
    return;
  }

  process.exitCode = 1;
}

program.parse();
