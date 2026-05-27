# Codex Mobile App ↔ Codex Desktop A-Z

Tài liệu này dành cho user phổ thông muốn kết nối Codex Mobile webapp của TicProxy với Codex Desktop/Codex CLI trên máy Windows.

## 1. Chuẩn bị VPS

1. Trỏ DNS domain/subdomain về IP VPS.
2. Cài Codex Mobile App trên VPS.
3. Sau khi installer chạy xong, lưu lại các giá trị:

```text
Server URL
Mobile token
Windows bridge token
Admin token
Proxy API key
```

4. Kiểm tra server:

```bash
curl -fsS http://127.0.0.1:4899/health
```

5. Nếu dùng reverse proxy HTTPS, truy cập:

```text
https://your-domain.example/?token=<Mobile token>
```

## 2. Chuẩn bị máy Windows local

Máy Windows local là máy đang có Codex Desktop/Codex CLI và các thread cần sync.

Cài Node.js 22 LTS:

```powershell
winget install OpenJS.NodeJS.LTS
node -v
npm -v
```

Cài hoặc kiểm tra Codex CLI:

```powershell
npm i -g @openai/codex
codex --version
codex app-server --help
```

Nếu đã cài Codex Desktop nhưng `codex` không nằm trong PATH, tìm `codex.exe` thật:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 -ExpandProperty FullName
```

Mở Codex Desktop/Codex CLI một lần và đăng nhập. Bridge chỉ điều phối, không thay thế bước cài/đăng nhập Codex local.

## 3. Cài Windows bridge

Trên máy Windows:

```powershell
$Bootstrap = "$env:TEMP\ticproxy-bootstrap-windows-bridge.ps1"
Invoke-WebRequest `
  -Uri "https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/bootstrap-windows-bridge.ps1" `
  -OutFile $Bootstrap
powershell -ExecutionPolicy Bypass -File $Bootstrap -RunNow
```

Khi installer hỏi, chỉ paste giá trị, không paste nhãn:

```text
Your server URL: https://your-domain.example
Windows bridge token: <Windows bridge token>
Proxy API key: <Proxy API key>
Codex home folder: C:\Users\<you>\.codex
Allowed folders: C:\Users\<you>\Documents;C:\Users\<you>\Desktop
```

Installer sẽ cố tự tìm `codex.exe` và ghi `TICMIRO_CODEX_BIN`.

## 4. Kiểm tra `.env.local`

File nằm tại:

```text
%USERPROFILE%\codex-mobile-app-one-api-to-rule-them-all\.env.local
```

Các dòng nên có:

```env
TICMIRO_SERVER_URL=https://your-domain.example
TICMIRO_AGENT_TOKEN=<windows-bridge-token>
CODEX_HOME=C:\Users\<you>\.codex
TICPROXY_BASE_URL=https://your-domain.example/v1
TICPROXY_API_KEY=<proxy-api-key>
TICMIRO_CODEX_BIN=C:\Users\<you>\AppData\Local\OpenAI\Codex\bin\<version>\codex.exe
TICMIRO_ALLOWED_ROOTS=C:\Users\<you>\Documents;C:\Users\<you>\Desktop
TICMIRO_CODEX_APP_SERVER_MODE=per-command
TICMIRO_THREAD_SNAPSHOT_WAIT_MS=15000
TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000
```

Windows mặc định dùng `per-command` vì ổn định hơn với Codex Desktop hiện tại. `managed` là chế độ thử nghiệm:

```env
TICMIRO_CODEX_APP_SERVER_MODE=managed
```

## 5. Restart bridge

```powershell
Stop-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "Codex Mobile App Bridge"
```

Nếu cần hard restart:

```powershell
$task = 'Codex Mobile App Bridge'
Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'codex-mobile-app-one-api-to-rule-them-all\\apps\\windows-bridge\\src\\index\.js' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $task
```

## 6. Kiểm tra trạng thái bridge

```powershell
cd "$env:USERPROFILE\codex-mobile-app-one-api-to-rule-them-all"
powershell -ExecutionPolicy Bypass -File .\scripts\status-windows-bridge.ps1
Get-Content .\runtime\logs\windows-bridge.log -Tail 120
```

Trên mobile webapp, tab `Agent` nên thấy:

```text
Bridge online
codex.thread.sync
codex.thread.send
codex.host.appServer
codex.desktop.restart
```

## 7. Dùng Codex Chat Mobile

1. Mở `https://your-domain.example/?token=<Mobile token>`.
2. Vào `Codex Chat`.
3. Bấm `Reload` nếu chưa thấy thread.
4. Chọn thread.
5. Bấm `Read` để tải transcript.
6. Gửi tin nhắn.
7. Trong lúc Codex trả lời lâu, bridge publish snapshot mỗi `TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS`.
8. Nếu Desktop UI không tự refresh, bấm `Refresh Desktop`.

Sau khi deploy mobile web JS mới, hard reload trình duyệt để tránh cache:

```text
Ctrl+F5 trên desktop, hoặc refresh hard trong mobile browser.
```

## 8. Cấu hình Refresh Desktop cho Windows AppX/MSIX

Nếu nút `Refresh Desktop` tắt được Codex nhưng không mở lại, tìm AppID:

```powershell
Get-StartApps | Where-Object { $_.Name -match 'Codex|OpenAI' }
```

Rồi thêm vào `.env.local`:

```env
TICMIRO_CODEX_DESKTOP_RESTART_COMMAND=Get-Process -Name Codex,codex -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 1200; Start-Process 'shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App'
```

Bridge bản mới cũng tự thử `Get-StartApps` nếu không tìm thấy `.exe` hoặc shortcut.

## 9. Cập nhật VPS và Windows bridge

VPS:

```bash
sudo -i
cd /opt/codex-mobile-app-one-api-to-rule-them-all
git pull --ff-only origin main
docker compose up -d --build
curl -fsS http://127.0.0.1:4899/health
```

Windows:

```powershell
cd "$env:USERPROFILE\codex-mobile-app-one-api-to-rule-them-all"
git pull --ff-only origin main
Stop-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "Codex Mobile App Bridge"
```

## 10. Lỗi thường gặp

| Lỗi | Cách sửa |
| --- | --- |
| `node is not recognized` | Cài Node.js 22 LTS |
| `codex is not recognized` | Cài Codex CLI bằng script OpenAI hoặc npm, hoặc set `TICMIRO_CODEX_BIN` tới `codex.exe` thật |
| `codex.cmd is not recognized` / quote lỗi | Pull bản mới, ưu tiên `TICMIRO_CODEX_BIN` tới `codex.exe` thay vì `.cmd` |
| Thread hiện `<environment_context>` | Pull bản mới, restart bridge, bấm Reload |
| Mobile nhìn như không có phản hồi | Kiểm tra `TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000`, restart bridge |
| Thứ tự user/assistant bị lộn | Deploy VPS/mobile web mới, hard reload browser, restart bridge để snapshot có `timestamp` |
| Desktop không tự hiện tin mới | Đây là giới hạn UI Desktop Windows; bấm `Refresh Desktop` |
| Refresh Desktop không mở lại | Set `TICMIRO_CODEX_DESKTOP_RESTART_COMMAND` bằng `shell:AppsFolder\<AppID>` |
