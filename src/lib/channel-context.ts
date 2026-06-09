import type { OAuth2Client } from "google-auth-library";
import {
  type AuthenticatedChannel,
  fetchMyChannels,
  getAuthorizedClient,
} from "../youtube/auth.js";

export interface ChannelContext {
  auth: OAuth2Client;
  channel: AuthenticatedChannel;
}

function printNoChannelMessage(): void {
  console.log("No channel associated with the current token.");
  console.log(
    "If you are a Brand Account manager, OAuth may not list that channel. Ask the owner to run auth login instead.",
  );
}

export async function withChannelContext(): Promise<ChannelContext | null> {
  const auth = await getAuthorizedClient();
  const channels = await fetchMyChannels(auth);

  if (channels.length === 0) {
    printNoChannelMessage();
    return null;
  }

  return {
    auth,
    channel: channels[0],
  };
}
