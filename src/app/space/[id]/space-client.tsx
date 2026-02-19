"use client";

import { useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/stores/game-store";
import { eventBridge, GameEvents } from "@/features/space/game";
import { useSocketBridge } from "@/features/space/bridge";
import { useChat, type ChatMessage } from "@/features/space/chat";
import GameCanvas from "@/components/space/game-canvas";
import LoadingScreen from "@/components/space/loading-screen";
import PlayerList from "@/components/space/player-list";
import SpaceHud from "@/components/space/space-hud";
import ChatPanel from "@/components/space/chat-panel";

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
  };
}

let chatMsgId = 0;

export default function SpaceClient({ space, user }: SpaceClientProps) {
  const { isLoading, isSceneReady, error, setSceneReady, setError, reset } = useGameStore();

  // sendChat ref: useSocketBridge 반환 후 할당됨
  const sendChatRef = useRef<(content: string, type: "group" | "whisper" | "party", targetId?: string) => void>(
    () => {}
  );

  const sendChatStable = useCallback(
    (content: string, type: "group" | "whisper" | "party", targetId?: string) => {
      sendChatRef.current(content, type, targetId);
    },
    []
  );

  const { messages, sendMessage, setChatFocused, addMessage } = useChat({
    sendChat: sendChatStable,
    userId: user.id,
    nickname: user.nickname,
  });

  const onChatMessage = useCallback(
    (data: { userId: string; nickname: string; content: string; type: string; timestamp: string }) => {
      const msg: ChatMessage = {
        id: `chat-${++chatMsgId}`,
        userId: data.userId,
        nickname: data.nickname,
        content: data.content,
        type: data.type as ChatMessage["type"],
        timestamp: data.timestamp,
      };
      addMessage(msg);
    },
    [addMessage]
  );

  const { isConnected, players, sendChat } = useSocketBridge({
    spaceId: space.id,
    userId: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    onChatMessage,
  });

  // sendChat이 사용 가능해지면 ref 업데이트
  sendChatRef.current = sendChat;

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
    <div className="relative h-screen w-screen overflow-hidden bg-gray-900">
      {/* Phaser Canvas */}
      <GameCanvas
        spaceId={space.id}
        userId={user.id}
        nickname={user.nickname}
        avatar={user.avatar}
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
          />
          <PlayerList
            players={players.map((p) => ({
              id: p.userId,
              nickname: p.nickname,
            }))}
            currentUserId={user.id}
            currentNickname={user.nickname}
          />
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            onFocusChange={setChatFocused}
          />
        </>
      )}
    </div>
  );
}
