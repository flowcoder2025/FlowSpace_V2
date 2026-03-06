#!/bin/bash
# ============================================
# FlowSpace v2 OCI 초기 설정 스크립트
# OCI 서버(ubuntu@144.24.72.143)에서 실행
# ============================================

set -euo pipefail

echo "=== Phase 3: OCI 서버 설정 ==="

# 3.1 iptables 포트 열기 (3002)
echo "[1/5] iptables 포트 3002 추가..."
sudo iptables -I INPUT -p tcp --dport 3002 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo sh -c "iptables-save > /etc/iptables/rules.v4"

# 3.2 프로젝트 클론
echo "[2/5] 프로젝트 클론..."
if [ -d ~/flowspace-v2 ]; then
  echo "  → 이미 존재, git pull..."
  cd ~/flowspace-v2
  git pull origin main
else
  cd ~
  git clone https://github.com/flowcoder2025/FlowSpace_V2.git flowspace-v2
  cd ~/flowspace-v2
fi

# 3.3 .env 생성
echo "[3/5] .env 생성..."
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
# === FlowSpace v2 Socket.io 서버 ===
SOCKET_PORT=3002
AUTH_SECRET=REPLACE_WITH_YOUR_AUTH_SECRET
AUTH_URL=https://v2.flow-coder.com
ENVEOF
  echo "  → .env 생성됨. AUTH_SECRET을 실제 값으로 교체하세요!"
  echo "  → nano ~/flowspace-v2/.env"
else
  echo "  → .env 이미 존재, 스킵"
fi

# 3.4 Docker Compose 빌드 & 실행
echo "[4/5] Docker Compose 빌드..."
docker compose -f docker-compose.prod.yml up --build -d

# 3.5 검증
echo "[5/5] 검증..."
sleep 3
curl -sf http://localhost:3002/socket.io/?EIO=4\&transport=polling | head -c 100 && echo "" && echo "✅ Socket.io 서버 정상!" || echo "❌ Socket.io 응답 없음"

echo ""
echo "=== Phase 4: Caddy vhost 추가 ==="
echo "아래 내용을 기존 Caddyfile에 추가하세요:"
echo ""
cat << 'CADDY'
v2-socket.flow-coder.com {
  tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key

  @websocket {
    header Connection *Upgrade*
    header Upgrade websocket
  }
  reverse_proxy @websocket 172.18.0.1:3002 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
  }
  reverse_proxy 172.18.0.1:3002 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Real-IP {remote_host}
  }
}
CADDY
echo ""
echo "추가 후: sudo caddy reload --config /etc/caddy/Caddyfile"

echo ""
echo "=== Phase 5: LiveKit API key 추가 ==="
echo "기존 livekit.yaml에 v2용 key 추가:"
echo "  keys:"
echo "    devkey: devsecret     # v1 기존"
echo "    v2key: v2secret       # v2 추가"
echo ""
echo "추가 후: docker restart livekit"
