@echo off
REM Deploy all Edge Functions to Supabase

echo Deploying Edge Functions...
REM admin-codes / admin-stats 含 collector scope（采集插件激活码），改动后需重新部署

supabase functions deploy plugin-active --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api
supabase functions deploy plugin-unactive --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api
supabase functions deploy plugin-check-time --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api
supabase functions deploy admin-login --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api
supabase functions deploy admin-codes --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api
supabase functions deploy admin-stats --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api
supabase functions deploy admin-logs --no-verify-jwt --project-ref hizynzkovnnugjedqpuw --use-api

echo.
echo Done!
pause
