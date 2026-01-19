#!/bin/bash

# Lance Data Viewer 起動スクリプト
# このスクリプトはLanceDB データを閲覧するためのWebUIを起動します

set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルプメッセージ
show_help() {
    echo -e "${BLUE}Lance Data Viewer 起動スクリプト${NC}"
    echo ""
    echo "使用方法:"
    echo "  $0 [コマンド] [オプション]"
    echo ""
    echo "コマンド:"
    echo "  start      Lance Data Viewerを起動 (デフォルト)"
    echo "  stop       Lance Data Viewerを停止"
    echo "  restart    Lance Data Viewerを再起動"
    echo "  status     Lance Data Viewerの状態を確認"
    echo "  logs       Lance Data Viewerのログを表示"
    echo "  help       このヘルプメッセージを表示"
    echo ""
    echo "オプション:"
    echo "  --legacy   レガシーバージョン (LanceDB 0.16.0) を使用"
    echo "  --port N   ポート番号を指定 (デフォルト: 8090)"
    echo ""
    echo "例:"
    echo "  $0 start           # 標準バージョンを起動"
    echo "  $0 start --legacy  # レガシーバージョンを起動"
    echo "  $0 status          # 状態確認"
    echo "  $0 logs            # ログ表示"
}

# データディレクトリの権限を設定
setup_permissions() {
    echo -e "${YELLOW}Lance データディレクトリの権限を設定中...${NC}"
    
    if [ -d "./data/sample-lancedb" ]; then
        chmod -R o+rx ./data/sample-lancedb
        echo -e "${GREEN}権限設定完了: ./data/sample-lancedb${NC}"
    else
        echo -e "${RED}警告: ./data/sample-lancedb が見つかりません${NC}"
        echo -e "${YELLOW}Lance データが存在することを確認してください${NC}"
    fi
}

# Lance Data Viewerを起動
start_viewer() {
    local use_legacy=false
    local port=8090
    
    # オプションの解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            --legacy)
                use_legacy=true
                port=8091
                shift
                ;;
            --port)
                port="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    setup_permissions
    
    echo -e "${BLUE}Lance Data Viewer を起動しています...${NC}"
    
    if [ "$use_legacy" = true ]; then
        echo -e "${YELLOW}レガシーバージョン (LanceDB 0.16.0) を使用します${NC}"
        docker-compose -f docker-compose.lance-viewer.yml --profile legacy up -d lance-data-viewer-legacy
        echo -e "${GREEN}Lance Data Viewer (Legacy) が起動しました!${NC}"
        echo -e "${BLUE}アクセスURL: http://localhost:8091${NC}"
    else
        echo -e "${YELLOW}標準バージョン (LanceDB 0.24.3) を使用します${NC}"
        docker-compose -f docker-compose.lance-viewer.yml up -d lance-data-viewer
        echo -e "${GREEN}Lance Data Viewer が起動しました!${NC}"
        echo -e "${BLUE}アクセスURL: http://localhost:8090${NC}"
    fi
    
    # 起動待機
    echo -e "${YELLOW}サービスの起動を待機しています...${NC}"
    sleep 5
    
    # ヘルスチェック
    if [ "$use_legacy" = true ]; then
        check_url="http://localhost:8091/healthz"
    else
        check_url="http://localhost:8090/healthz"
    fi
    
    if curl -f -s "$check_url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ サービスが正常に起動しました${NC}"
        echo -e "${BLUE}Lance データを閲覧できます: $check_url${NC}"
    else
        echo -e "${RED}⚠️  サービスの起動に時間がかかっています。少し待ってからアクセスしてください${NC}"
    fi
}

# Lance Data Viewerを停止
stop_viewer() {
    echo -e "${YELLOW}Lance Data Viewer を停止しています...${NC}"
    docker-compose -f docker-compose.lance-viewer.yml down
    echo -e "${GREEN}Lance Data Viewer が停止しました${NC}"
}

# Lance Data Viewerを再起動
restart_viewer() {
    echo -e "${YELLOW}Lance Data Viewer を再起動しています...${NC}"
    stop_viewer
    start_viewer "$@"
}

# Lance Data Viewerの状態を確認
check_status() {
    echo -e "${BLUE}Lance Data Viewer の状態:${NC}"
    echo ""
    
    # Docker Compose サービスの状態
    docker-compose -f docker-compose.lance-viewer.yml ps
    echo ""
    
    # ヘルスチェック
    echo -e "${BLUE}ヘルスチェック:${NC}"
    
    # 標準バージョン
    if curl -f -s http://localhost:8090/healthz > /dev/null 2>&1; then
        echo -e "標準版 (port 8090): ${GREEN}✅ 正常${NC}"
        echo -e "  アクセスURL: ${BLUE}http://localhost:8090${NC}"
    else
        echo -e "標準版 (port 8090): ${RED}❌ 停止中${NC}"
    fi
    
    # レガシーバージョン
    if curl -f -s http://localhost:8091/healthz > /dev/null 2>&1; then
        echo -e "レガシー版 (port 8091): ${GREEN}✅ 正常${NC}"
        echo -e "  アクセスURL: ${BLUE}http://localhost:8091${NC}"
    else
        echo -e "レガシー版 (port 8091): ${RED}❌ 停止中${NC}"
    fi
}

# ログを表示
show_logs() {
    echo -e "${BLUE}Lance Data Viewer のログ:${NC}"
    docker-compose -f docker-compose.lance-viewer.yml logs -f
}

# メイン処理
main() {
    local command="${1:-start}"
    
    case $command in
        start)
            shift
            start_viewer "$@"
            ;;
        stop)
            stop_viewer
            ;;
        restart)
            shift
            restart_viewer "$@"
            ;;
        status)
            check_status
            ;;
        logs)
            show_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}不正なコマンド: $command${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# スクリプトが直接実行された場合
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi