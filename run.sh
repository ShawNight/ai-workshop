#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PID_FILE="$SCRIPT_DIR/backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/frontend.pid"

cleanup() {
    echo "正在停止服务..."
    [ -f "$BACKEND_PID_FILE" ] && kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null
    [ -f "$FRONTEND_PID_FILE" ] && kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
    echo "已停止所有服务"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python3"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
fi

setup_backend_venv() {
    if [ ! -f "$VENV_PYTHON" ]; then
        echo "后端虚拟环境不存在，正在创建..."
        cd "$BACKEND_DIR"
        python3 -m venv .venv
        .venv/bin/pip install -r requirements.txt
        echo "虚拟环境创建完成"
    fi
}

start_backend() {
    echo "启动后端服务..."
    cd "$BACKEND_DIR"
    "$VENV_PYTHON" app.py &
    echo $! > "$BACKEND_PID_FILE"
    echo "后端服务已启动 (PID: $(cat "$BACKEND_PID_FILE"))"
}

start_frontend() {
    echo "启动前端服务..."
    cd "$FRONTEND_DIR"
    npm run dev &
    echo $! > "$FRONTEND_PID_FILE"
    echo "前端服务已启动 (PID: $(cat "$FRONTEND_PID_FILE"))"
}

stop_services() {
    cleanup
}

status_services() {
    echo "=== 服务状态 ==="
    [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null && echo "后端: 运行中 (PID: $(cat "$BACKEND_PID_FILE"))" || echo "后端: 未运行"
    [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null && echo "前端: 运行中 (PID: $(cat "$FRONTEND_PID_FILE"))" || echo "前端: 未运行"
}

case "${1:-start}" in
    start)
        setup_backend_venv
        start_backend
        sleep 1
        start_frontend
        echo ""
        echo "所有服务已启动!"
        echo "后端: http://localhost:3001"
        echo "前端: http://localhost:5173"
        wait
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 1
        start_backend
        sleep 1
        start_frontend
        wait
        ;;
    status)
        status_services
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
