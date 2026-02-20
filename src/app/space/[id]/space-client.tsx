"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useGameStore } from "@/stores/game-store";
import { eventBridge, GameEvents } from "@/features/space/game";
import { useSocketBridge } from "@/features/space/bridge";
import { useChat, type ChatMessage } from "@/features/space/chat";
import { useEditor, type StoredMapData, type EditorMapObject } from "@/features/space/editor";
import { LiveKitRoomProvider } from "@/features/space/livekit";
import type { RecordingStatusData, SpotlightData, ProximityChangedData } from "@/features/space/socket";
import GameCanvas from "@/components/space/game-canvas";
import LoadingScreen from "@/components/space/loading-screen";
import SpaceHud from "@/components/space/space-hud";
import ChatPanel from "@/components/space/chat-panel";
import { EditorToggleButton, EditorSidebar } from "@/components/space/editor";
import { SpaceMediaLayer } from "@/components/space/video/SpaceMediaLayer";

interface SpaceClientProps {
  space: {
    id: string;
    name: string;
    description: string | null;
    maxUsers: number;
    memberCount: number;
  };
  user: {
    id: string;
    nickname: string;
    avatar: string;
    role?: "OWNER" | "STAFF" | "PARTICIPANT";
  };
}

let chatMsgId = Date.now();

export default function SpaceClient({ space, user }: SpaceClientProps) {
  const { isLoading, isSceneReady, error, setSceneReady, setError, reset } = useGameStore();
  const [mapData, setMapData] = useState<StoredMapData | null>(null);
  const [mapObjects, setMapObjects] = useState<EditorMapObject[]>([]);

  // Media state (from socket events)
  const [isRecording, setIsRecording] = useState(false);
  const [recorderNickname, setRecorderNickname] = useState<string>();
  const [spotlightUsers, setSpotlightUsers] = useState<Set<string>>(new Set());

  // 맵 데이터 로드
  useEffect(() => {
    let cancelled = false;
    async function loadMap() {
      try {
        const res = await fetch(`/api/spaces/${space.id}/map`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.mapData) setMapData(data.mapData as StoredMapData);
        if (data.objects) setMapObjects(data.objects as EditorMapObject[]);
      } catch {
        // 맵 데이터 로드 실패 시 기본 맵 사용
      }
    }
    loadMap();
    return () => { cancelled = true; };
  }, [space.id]);

  // SCENE_READY 후 맵 오브젝트를 EventBridge로 전달
  useEffect(() => {
    if (!isSceneReady || mapObjects.length === 0) return;
    eventBridge.emit(GameEvents.EDITOR_MAP_LOADED, {
      layers: mapData?.layers ?? null,
      objects: mapObjects,
    });
  }, [isSceneReady, mapData, mapObjects]);

  // 에디터 훅
  const canEdit = user.role === "OWNER" || user.role === "STAFF";
  const editor = useEditor({ spaceId: space.id, canEdit });

  // 맵 오브젝트를 에디터 스토어에도 동기화
  useEffect(() => {
    if (mapObjects.length > 0) {
      editor.setMapObjects(mapObjects);
    }
  }, [mapObjects]); // eslint-disable-line react-hooks/exhaustive-deps

  // 맵 타일 데이터를 에디터 스토어에 동기화
  useEffect(() => {
    if (mapData?.layers) {
      editor.setTileData(mapData.layers);
    }
  }, [mapData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refs for circular dependency resolution (useChat <-> useSocketBridge)
  const sendChatRef = useRef<(content: string, type: "group" | "whisper" | "party", targetId?: string) => void>(
    () => {}
  );
  const sendWhisperRef = useRef<(targetNickname: string, content: string) => void>(() => {});
  const sendReactionToggleRef = useRef<(messageId: string, reactionType: "thumbsup" | "heart" | "check") => void>(
    () => {}
  );
  const sendAdminCommandRef = useRef<(command: string, data: Record<string, unknown>) => void>(() => {});

  const sendChatStable = useCallback(
    (content: string, type: "group" | "whisper" | "party", targetId?: string) => {
      sendChatRef.current(content, type, targetId);
    },
    []
  );
  const sendWhisperStable = useCallback(
    (targetNickname: string, content: string) => sendWhisperRef.current(targetNickname, content),
    []
  );
  const sendReactionStable = useCallback(
    (messageId: string, reactionType: "thumbsup" | "heart" | "check") =>
      sendReactionToggleRef.current(messageId, reactionType),
    []
  );
  const sendAdminStable = useCallback(
    (command: string, data: Record<string, unknown>) => sendAdminCommandRef.current(command, data),
    []
  );

  const chatReturn = useChat({
    sendChat: sendChatStable,
    sendWhisper: sendWhisperStable,
    sendReactionToggle: sendReactionStable,
    sendAdminCommand: sendAdminStable,
    spaceId: space.id,
    userId: user.id,
    nickname: user.nickname,
    role: user.role,
  });

  const {
    messages, activeTab, setActiveTab, sendMessage, setChatFocused, addMessage,
    replyTo, setReplyTo, toggleReaction, deleteMessage,
  } = chatReturn;

  // 내부 핸들러 (타입 캐스트로 접근)
  const chatInternal = chatReturn as unknown as {
    _handleMessageIdUpdate: (tempId: string, realId: string) => void;
    _handleMessageFailed: (tempId: string) => void;
    _handleMessageDeleted: (messageId: string) => void;
    _handleReactionUpdated: (
      messageId: string,
      reactions: Array<{ type: "thumbsup" | "heart" | "check"; userId: string; userNickname: string }>
    ) => void;
  };

  // Socket callbacks — Chat
  const onChatMessage = useCallback(
    (data: {
      id?: string;
      tempId?: string;
      userId: string;
      nickname: string;
      content: string;
      type: string;
      timestamp: string;
      replyTo?: { id: string; senderNickname: string; content: string };
      partyId?: string;
      partyName?: string;
    }) => {
      const msg: ChatMessage = {
        id: data.id || `chat-${++chatMsgId}`,
        tempId: data.tempId,
        userId: data.userId,
        nickname: data.nickname,
        content: data.content,
        type: data.type as ChatMessage["type"],
        timestamp: data.timestamp,
        replyTo: data.replyTo,
        partyId: data.partyId,
        partyName: data.partyName,
      };
      addMessage(msg);
    },
    [addMessage]
  );

  const onWhisperReceive = useCallback(
    (data: { senderId: string; senderNickname: string; content: string; timestamp: string }) => {
      const msg: ChatMessage = {
        id: `whisper-in-${++chatMsgId}`,
        userId: data.senderId,
        nickname: data.senderNickname,
        content: data.content,
        type: "whisper",
        timestamp: data.timestamp,
      };
      addMessage(msg);
    },
    [addMessage]
  );

  const onWhisperSent = useCallback(
    (data: { targetNickname: string; content: string; timestamp: string }) => {
      // 이미 낙관적으로 추가됨 (useChat에서)
      void data;
    },
    []
  );

  const onMessageIdUpdate = useCallback(
    (data: { tempId: string; realId: string }) => {
      chatInternal._handleMessageIdUpdate?.(data.tempId, data.realId);
    },
    [chatInternal]
  );

  const onMessageFailed = useCallback(
    (data: { tempId: string; error: string }) => {
      chatInternal._handleMessageFailed?.(data.tempId);
    },
    [chatInternal]
  );

  const onMessageDeleted = useCallback(
    (data: { messageId: string; deletedBy: string }) => {
      chatInternal._handleMessageDeleted?.(data.messageId);
    },
    [chatInternal]
  );

  const onReactionUpdated = useCallback(
    (data: {
      messageId: string;
      reactions: Array<{ type: "thumbsup" | "heart" | "check"; userId: string; userNickname: string }>;
    }) => {
      chatInternal._handleReactionUpdated?.(data.messageId, data.reactions);
    },
    [chatInternal]
  );

  const onMemberMuted = useCallback(
    (data: { nickname: string; mutedBy: string }) => {
      addMessage({
        id: `sys-${++chatMsgId}`,
        userId: "system",
        nickname: "System",
        content: `${data.nickname}님이 ${data.mutedBy}에 의해 뮤트되었습니다.`,
        type: "system",
        timestamp: new Date().toISOString(),
      });
    },
    [addMessage]
  );

  const onMemberUnmuted = useCallback(
    (data: { nickname: string; unmutedBy: string }) => {
      addMessage({
        id: `sys-${++chatMsgId}`,
        userId: "system",
        nickname: "System",
        content: `${data.nickname}님의 뮤트가 ${data.unmutedBy}에 의해 해제되었습니다.`,
        type: "system",
        timestamp: new Date().toISOString(),
      });
    },
    [addMessage]
  );

  const onMemberKicked = useCallback(
    (data: { nickname: string; kickedBy: string }) => {
      addMessage({
        id: `sys-${++chatMsgId}`,
        userId: "system",
        nickname: "System",
        content: `${data.nickname}님이 ${data.kickedBy}에 의해 추방되었습니다.`,
        type: "system",
        timestamp: new Date().toISOString(),
      });
    },
    [addMessage]
  );

  const onAnnouncement = useCallback(
    (data: { content: string; announcer: string; timestamp: string }) => {
      addMessage({
        id: `announce-${++chatMsgId}`,
        userId: "system",
        nickname: data.announcer,
        content: data.content,
        type: "announcement",
        timestamp: data.timestamp,
      });
    },
    [addMessage]
  );

  // Socket callbacks — Media
  const onRecordingStarted = useCallback((data: RecordingStatusData) => {
    setIsRecording(data.isRecording);
    setRecorderNickname(data.recorderNickname);
  }, []);

  const onRecordingStopped = useCallback((_: RecordingStatusData) => {
    void _;
    setIsRecording(false);
    setRecorderNickname(undefined);
  }, []);

  const onSpotlightActivated = useCallback((data: SpotlightData) => {
    setSpotlightUsers((prev) => new Set(prev).add(data.participantId));
  }, []);

  const onSpotlightDeactivated = useCallback((data: SpotlightData) => {
    setSpotlightUsers((prev) => {
      const next = new Set(prev);
      next.delete(data.participantId);
      return next;
    });
  }, []);

  const onProximityChanged = useCallback((_: ProximityChangedData) => {
    void _;
    // Proximity 상태는 LiveKit useProximitySubscription에서 직접 관리
  }, []);

  const onSocketError = useCallback(
    (data: { code: string; message: string }) => {
      console.warn(`[Socket] Error (${data.code}): ${data.message}`);
      addMessage({
        id: `sys-${++chatMsgId}`,
        userId: "system",
        nickname: "System",
        content: data.message,
        type: "system",
        timestamp: new Date().toISOString(),
      });
    },
    [addMessage]
  );

  const {
    isConnected, socketError, players, sendChat, sendWhisper,
    sendReactionToggle, sendAdminCommand,
  } = useSocketBridge({
    spaceId: space.id,
    userId: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    onChatMessage,
    onWhisperReceive,
    onWhisperSent,
    onMessageIdUpdate,
    onMessageFailed,
    onMessageDeleted,
    onReactionUpdated,
    onMemberMuted,
    onMemberUnmuted,
    onMemberKicked,
    onAnnouncement,
    onRecordingStarted,
    onRecordingStopped,
    onSpotlightActivated,
    onSpotlightDeactivated,
    onProximityChanged,
    onSocketError,
  });

  // Ref 업데이트
  sendChatRef.current = sendChat;
  sendWhisperRef.current = sendWhisper;
  sendReactionToggleRef.current = sendReactionToggle;
  sendAdminCommandRef.current = sendAdminCommand;

  // SCENE_READY / SCENE_ERROR 이벤트 리스닝
  useEffect(() => {
    const onSceneReady = () => {
      setSceneReady(true);
    };

    const onSceneError = (payload: unknown) => {
      const { error: errMsg } = payload as { error: string };
      setError(errMsg);
    };

    eventBridge.on(GameEvents.SCENE_READY, onSceneReady);
    eventBridge.on(GameEvents.SCENE_ERROR, onSceneError);

    return () => {
      eventBridge.off(GameEvents.SCENE_READY, onSceneReady);
      eventBridge.off(GameEvents.SCENE_ERROR, onSceneError);
      reset();
    };
  }, [setSceneReady, setError, reset]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
          <a href="/my-spaces" className="mt-4 inline-block text-blue-400 hover:underline">
            Back to Spaces
          </a>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoomProvider
      spaceId={space.id}
      participantId={user.id}
      participantName={user.nickname}
    >
      <div className="relative h-screen w-screen overflow-hidden bg-gray-900">
        {/* Phaser Canvas */}
        <GameCanvas
          spaceId={space.id}
          userId={user.id}
          nickname={user.nickname}
          avatar={user.avatar}
          mapData={mapData}
        />

        {/* Loading Overlay */}
        {isLoading && <LoadingScreen spaceName={space.name} />}

        {/* HUD (씬 준비 후 표시) */}
        {isSceneReady && (
          <>
            <SpaceHud
              spaceName={space.name}
              isConnected={isConnected}
              playerCount={players.length + 1}
              editorSlot={
                <EditorToggleButton
                  isEditorMode={editor.isEditorMode}
                  canEdit={editor.canEdit}
                  onToggle={() =>
                    editor.isEditorMode
                      ? editor.exitEditor()
                      : editor.enterEditor()
                  }
                />
              }
            />
            <ChatPanel
              messages={messages}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onSend={sendMessage}
              onFocusChange={setChatFocused}
              onReply={setReplyTo}
              onReactionToggle={toggleReaction}
              onDeleteMessage={deleteMessage}
              replyTo={replyTo}
              currentUserId={user.id}
              role={user.role}
              players={players}
              socketError={socketError}
            />

            {/* LiveKit Media Layer */}
            <SpaceMediaLayer
              spaceName={space.name}
              spotlightUsers={spotlightUsers}
              isRecording={isRecording}
              recorderNickname={recorderNickname}
              players={players}
              currentUserId={user.id}
              currentNickname={user.nickname}
            />

            {/* Editor Sidebar */}
            {editor.isEditorMode && (
              <EditorSidebar
                activeTool={editor.activeTool}
                activeLayer={editor.activeLayer}
                selectedTileIndex={editor.selectedTileIndex}
                selectedObjectType={editor.selectedObjectType}
                selectedObject={
                  editor.selectedObjectId
                    ? editor.mapObjects.find(
                        (o) => o.id === editor.selectedObjectId
                      ) ?? null
                    : null
                }
                paletteTab={editor.paletteTab}
                layerVisibility={editor.layerVisibility}
                isDirty={editor.isDirty}
                isSaving={editor.isSaving}
                onToolChange={editor.setTool}
                onLayerChange={editor.setLayer}
                onTileSelect={editor.setTile}
                onObjectTypeSelect={editor.setObjectType}
                onToggleLayerVisibility={editor.toggleLayerVisibility}
                onPaletteTabChange={editor.setPaletteTab}
                onSave={editor.saveTiles}
                onDeleteObject={editor.deleteObject}
                onLinkPortal={(sourceId) => {
                  // 간단한 포탈 링킹: 다음 포탈 선택 대기 모드
                  const portals = editor.mapObjects.filter(
                    (o) =>
                      o.objectType === "portal" && o.id !== sourceId
                  );
                  if (portals.length > 0) {
                    editor.linkPortal(sourceId, portals[0].id);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </LiveKitRoomProvider>
  );
}
