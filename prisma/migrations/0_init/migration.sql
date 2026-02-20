-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TemplateKey" AS ENUM ('OFFICE', 'CLASSROOM', 'LOUNGE');

-- CreateEnum
CREATE TYPE "SpaceAccessType" AS ENUM ('PUBLIC', 'PRIVATE', 'PASSWORD');

-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SpaceEventType" AS ENUM ('ENTER', 'EXIT', 'INTERACTION', 'CHAT', 'ADMIN_ACTION', 'VIDEO_START', 'VIDEO_END', 'SCREEN_SHARE_START', 'SCREEN_SHARE_END');

-- CreateEnum
CREATE TYPE "SpaceRole" AS ENUM ('OWNER', 'STAFF', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "ChatRestriction" AS ENUM ('NONE', 'MUTED', 'BANNED');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('USER', 'GUEST');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('MESSAGE', 'WHISPER', 'PARTY', 'SYSTEM', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CHARACTER', 'TILESET', 'OBJECT', 'MAP');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "avatarConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "key" "TemplateKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "assetsPath" TEXT NOT NULL,
    "previewUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "accessType" "SpaceAccessType" NOT NULL DEFAULT 'PUBLIC',
    "accessSecret" TEXT,
    "inviteCode" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "loadingMessage" TEXT,
    "status" "SpaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxUsers" INTEGER NOT NULL DEFAULT 50,
    "mapData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT 'default',
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceEventLog" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "eventType" "SpaceEventType" NOT NULL,
    "payload" JSONB,
    "participantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceMember" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "displayName" TEXT,
    "role" "SpaceRole" NOT NULL DEFAULT 'PARTICIPANT',
    "restriction" "ChatRestriction" NOT NULL DEFAULT 'NONE',
    "restrictedUntil" TIMESTAMP(3),
    "restrictedBy" TEXT,
    "restrictedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapObject" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "assetId" TEXT,
    "objectType" TEXT NOT NULL,
    "label" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "linkedObjectId" TEXT,
    "customData" JSONB,
    "placedBy" TEXT NOT NULL,
    "placedByType" "SenderType" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderType" "SenderType" NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'MESSAGE',
    "targetId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyZone" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boundsX1" INTEGER NOT NULL,
    "boundsY1" INTEGER NOT NULL,
    "boundsX2" INTEGER NOT NULL,
    "boundsY2" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByType" "SenderType" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "filePath" TEXT,
    "thumbnailPath" TEXT,
    "fileSize" INTEGER,
    "comfyuiJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "assetType" "AssetType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotlightGrant" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "grantedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotlightGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_key" ON "Template"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Space_inviteCode_key" ON "Space"("inviteCode");

-- CreateIndex
CREATE INDEX "Space_ownerId_idx" ON "Space"("ownerId");

-- CreateIndex
CREATE INDEX "Space_inviteCode_idx" ON "Space"("inviteCode");

-- CreateIndex
CREATE INDEX "Space_status_idx" ON "Space"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_sessionToken_key" ON "GuestSession"("sessionToken");

-- CreateIndex
CREATE INDEX "GuestSession_spaceId_idx" ON "GuestSession"("spaceId");

-- CreateIndex
CREATE INDEX "GuestSession_sessionToken_idx" ON "GuestSession"("sessionToken");

-- CreateIndex
CREATE INDEX "GuestSession_spaceId_createdAt_idx" ON "GuestSession"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "GuestSession_spaceId_nickname_idx" ON "GuestSession"("spaceId", "nickname");

-- CreateIndex
CREATE INDEX "SpaceEventLog_spaceId_idx" ON "SpaceEventLog"("spaceId");

-- CreateIndex
CREATE INDEX "SpaceEventLog_userId_idx" ON "SpaceEventLog"("userId");

-- CreateIndex
CREATE INDEX "SpaceEventLog_guestSessionId_idx" ON "SpaceEventLog"("guestSessionId");

-- CreateIndex
CREATE INDEX "SpaceEventLog_eventType_idx" ON "SpaceEventLog"("eventType");

-- CreateIndex
CREATE INDEX "SpaceEventLog_createdAt_idx" ON "SpaceEventLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SpaceEventLog_spaceId_eventType_createdAt_idx" ON "SpaceEventLog"("spaceId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SpaceMember_spaceId_role_idx" ON "SpaceMember"("spaceId", "role");

-- CreateIndex
CREATE INDEX "SpaceMember_userId_idx" ON "SpaceMember"("userId");

-- CreateIndex
CREATE INDEX "SpaceMember_guestSessionId_idx" ON "SpaceMember"("guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceMember_spaceId_userId_key" ON "SpaceMember"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceMember_spaceId_guestSessionId_key" ON "SpaceMember"("spaceId", "guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MapObject_linkedObjectId_key" ON "MapObject"("linkedObjectId");

-- CreateIndex
CREATE INDEX "MapObject_spaceId_idx" ON "MapObject"("spaceId");

-- CreateIndex
CREATE INDEX "MapObject_assetId_idx" ON "MapObject"("assetId");

-- CreateIndex
CREATE INDEX "MapObject_linkedObjectId_idx" ON "MapObject"("linkedObjectId");

-- CreateIndex
CREATE INDEX "MapObject_spaceId_isActive_idx" ON "MapObject"("spaceId", "isActive");

-- CreateIndex
CREATE INDEX "ChatMessage_spaceId_createdAt_idx" ON "ChatMessage"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_type_idx" ON "ChatMessage"("type");

-- CreateIndex
CREATE INDEX "PartyZone_spaceId_idx" ON "PartyZone"("spaceId");

-- CreateIndex
CREATE INDEX "GeneratedAsset_userId_idx" ON "GeneratedAsset"("userId");

-- CreateIndex
CREATE INDEX "GeneratedAsset_type_idx" ON "GeneratedAsset"("type");

-- CreateIndex
CREATE INDEX "GeneratedAsset_status_idx" ON "GeneratedAsset"("status");

-- CreateIndex
CREATE INDEX "GeneratedAsset_createdAt_idx" ON "GeneratedAsset"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AssetWorkflow_assetType_idx" ON "AssetWorkflow"("assetType");

-- CreateIndex
CREATE INDEX "AssetWorkflow_isActive_idx" ON "AssetWorkflow"("isActive");

-- CreateIndex
CREATE INDEX "SpotlightGrant_spaceId_idx" ON "SpotlightGrant"("spaceId");

-- CreateIndex
CREATE INDEX "SpotlightGrant_spaceId_userId_idx" ON "SpotlightGrant"("spaceId", "userId");

-- CreateIndex
CREATE INDEX "SpotlightGrant_spaceId_guestSessionId_idx" ON "SpotlightGrant"("spaceId", "guestSessionId");

-- CreateIndex
CREATE INDEX "SpotlightGrant_isActive_idx" ON "SpotlightGrant"("isActive");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceEventLog" ADD CONSTRAINT "SpaceEventLog_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceEventLog" ADD CONSTRAINT "SpaceEventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceEventLog" ADD CONSTRAINT "SpaceEventLog_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapObject" ADD CONSTRAINT "MapObject_linkedObjectId_fkey" FOREIGN KEY ("linkedObjectId") REFERENCES "MapObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapObject" ADD CONSTRAINT "MapObject_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyZone" ADD CONSTRAINT "PartyZone_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotlightGrant" ADD CONSTRAINT "SpotlightGrant_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

