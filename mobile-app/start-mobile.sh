#!/usr/bin/env bash
set -euo pipefail

detect_mac_ip() {
  local interface ip

  interface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "${interface}" ]]; then
    ip="$(ipconfig getifaddr "${interface}" 2>/dev/null || true)"
    if [[ -n "${ip}" ]]; then
      printf '%s' "${ip}"
      return 0
    fi
  fi

  for interface in en0 en1; do
    ip="$(ipconfig getifaddr "${interface}" 2>/dev/null || true)"
    if [[ -n "${ip}" ]]; then
      printf '%s' "${ip}"
      return 0
    fi
  done

  return 1
}

MAC_IP="${MOBILE_HOST_IP:-$(detect_mac_ip || true)}"

if [[ -z "${MAC_IP}" ]]; then
  echo "Erro: nao foi possivel descobrir o IP de rede do Mac."
  echo "Defina manualmente, por exemplo: MOBILE_HOST_IP=192.168.1.12 bash start-mobile.sh"
  exit 1
fi

export EXPO_PUBLIC_API_URL="http://${MAC_IP}:8000"
export EXPO_PACKAGER_PROXY_URL="http://${MAC_IP}:8081"

echo ""
echo "Mobile usando o IP do Mac: ${MAC_IP}"
echo "API:   ${EXPO_PUBLIC_API_URL}"
echo "Metro: exp://${MAC_IP}:8081"
echo ""

exec docker compose up "$@"
