import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import type { SpaceEventType, Prisma } from "@prisma/client";

// ============================================
// Configuration
// ============================================
const IS_DEV = process.env.NODE_ENV === "development";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

// ============================================
// Webhook Receiver
// ============================================
let webhookReceiver: WebhookReceiver | null = null;

function getWebhookReceiver(): WebhookReceiver | null {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    if (IS_DEV) {
      console.warn(
        "[LiveKit Webhook] No API credentials - webhook verification disabled in dev mode"
      );
      return null;
    }
    throw new Error(
      "LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required"
    );
  }

  if (!webhookReceiver) {
    webhookReceiver = new WebhookReceiver(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );
  }
  return webhookReceiver;
}

// ============================================
// Helpers
// ============================================
function extractSpaceId(roomName: string): string | null {
  const match = roomName.match(/^space-(.+)$/);
  return match ? match[1] : null;
}

interface TrackInfo {
  type?: string;
  source?: string;
}

function getEventTypeFromTrack(
  track: TrackInfo,
  isPublished: boolean
): SpaceEventType | null {
  const trackType = track.type?.toUpperCase();
  const trackSource = track.source?.toUpperCase();

  if (trackType === "VIDEO") {
    if (trackSource === "SCREEN_SHARE") {
      return isPublished ? "SCREEN_SHARE_START" : "SCREEN_SHARE_END";
    }
    return isPublished ? "VIDEO_START" : "VIDEO_END";
  }

  return null;
}

// ============================================
// POST /api/livekit/webhook
// ============================================
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const authHeader = request.headers.get("authorization");

    const receiver = getWebhookReceiver();
    let event: Record<string, unknown>;

    if (receiver && authHeader) {
      try {
        event = (await receiver.receive(
          rawBody,
          authHeader
        )) as unknown as Record<string, unknown>;
      } catch (verifyError) {
        console.error(
          "[LiveKit Webhook] Signature verification failed:",
          verifyError
        );
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    } else if (IS_DEV) {
      try {
        event = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Webhook authentication required" },
        { status: 401 }
      );
    }

    if (IS_DEV) {
      console.log(
        "[LiveKit Webhook] Received event:",
        event.event
      );
    }

    const eventType = event.event as string;
    const room = event.room as { name?: string } | undefined;
    const participant = event.participant as {
      identity?: string;
      name?: string;
    } | undefined;
    const track = event.track as TrackInfo | undefined;

    if (!room?.name) {
      return NextResponse.json({ received: true });
    }

    const spaceId = extractSpaceId(room.name);
    if (!spaceId) {
      return NextResponse.json({ received: true });
    }

    switch (eventType) {
      case "track_published": {
        if (!track || !participant) break;

        const logEventType = getEventTypeFromTrack(track, true);
        if (logEventType) {
          await logSpaceEvent({
            spaceId,
            eventType: logEventType,
            participantId: participant.identity || "",
            payload: {
              trackType: track.type,
              trackSource: track.source,
              participantName: participant.name,
            },
          });
        }
        break;
      }

      case "track_unpublished": {
        if (!track || !participant) break;

        const logEventType = getEventTypeFromTrack(track, false);
        if (logEventType) {
          await logSpaceEvent({
            spaceId,
            eventType: logEventType,
            participantId: participant.identity || "",
            payload: {
              trackType: track.type,
              trackSource: track.source,
              participantName: participant.name,
            },
          });
        }
        break;
      }

      case "participant_joined":
      case "participant_left":
        if (IS_DEV && participant) {
          console.log(
            `[LiveKit Webhook] Participant ${eventType === "participant_joined" ? "joined" : "left"}: ${participant.identity}`
          );
        }
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[LiveKit Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// ============================================
// Helper: Log space event
// ============================================
interface LogEventParams {
  spaceId: string;
  eventType: SpaceEventType;
  participantId: string;
  payload?: Prisma.InputJsonValue;
}

async function logSpaceEvent(params: LogEventParams): Promise<void> {
  const { spaceId, eventType, participantId, payload } = params;

  try {
    let userId: string | undefined;
    let guestSessionId: string | undefined;

    if (participantId.startsWith("user-")) {
      userId = participantId.replace("user-", "");
    } else if (participantId.startsWith("guest-")) {
      guestSessionId = participantId.replace("guest-", "");
    }

    await prisma.spaceEventLog.create({
      data: {
        spaceId,
        eventType,
        participantId,
        userId,
        guestSessionId,
        payload,
      },
    });
  } catch (error) {
    console.error("[LiveKit Webhook] Failed to log event:", error);
  }
}
