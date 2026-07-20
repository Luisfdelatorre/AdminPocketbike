#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

child_pids=()
service_labels=()
services_started=0

stop_services() {
    local exit_code=$?

    trap - EXIT INT TERM

    if ((services_started > 0)); then
        echo ""
        echo "Deteniendo túnel de base de datos, API y frontend..."
        kill "${child_pids[@]}" 2>/dev/null || true
        wait "${child_pids[@]}" 2>/dev/null || true
    fi

    exit "$exit_code"
}

start_service() {
    local label=$1
    shift

    echo "Iniciando ${label}..."
    "$@" &
    child_pids+=("$!")
    service_labels+=("$label")
    ((services_started += 1))
}

monitor_services() {
    local index pid label exit_code

    while true; do
        for index in "${!child_pids[@]}"; do
            pid=${child_pids[$index]}
            label=${service_labels[$index]}

            if ! kill -0 "$pid" 2>/dev/null; then
                if wait "$pid"; then
                    exit_code=0
                else
                    exit_code=$?
                fi

                echo ""
                echo "${label} se detuvo inesperadamente (código ${exit_code})."
                return "$exit_code"
            fi
        done

        sleep 1
    done
}

trap stop_services EXIT INT TERM

start_service "túnel de base de datos (MongoDB compartido)" npm run dev:db-tunnel
start_service "API en http://localhost:8084" npm run dev:api
start_service "frontend en http://localhost:5173" npm run dev -- --port 5173 --strictPort

echo ""
echo "Servicios iniciados. Abre http://localhost:5173"
echo "Usa Ctrl+C para detenerlos todos."

monitor_services
