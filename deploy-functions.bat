@echo off
REM Deploy all Edge Functions to Supabase

echo Deploying Edge Functions...

supabase functions deploy plugin-active --no-verify-jwt --project-ref hizynzkovnnugjedqpuw
supabase functions deploy plugin-unactive --no-verify-jwt --project-ref hizynzkovnnugjedqpuw
supabase functions deploy plugin-check-time --no-verify-jwt --project-ref hizynzkovnnugjedqpuw
supabase functions deploy admin-login --no-verify-jwt --project-ref hizynzkovnnugjedqpuw
supabase functions deploy admin-codes --no-verify-jwt --project-ref hizynzkovnnugjedqpuw
supabase functions deploy admin-stats --no-verify-jwt --project-ref hizynzkovnnugjedqpuw
supabase functions deploy admin-logs --no-verify-jwt --project-ref hizynzkovnnugjedqpuw

echo.
echo Done!
pause
