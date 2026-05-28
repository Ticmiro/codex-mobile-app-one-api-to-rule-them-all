# Codex Chat Sync

Tài liệu này dùng để cấu hình đồng bộ cuộc trò chuyện Codex Desktop trên máy Windows lên Codex Chat Mobile của TicProxy.

## Trả lời nhanh

Đúng, bạn có thể đưa tài liệu này cho Codex Desktop trên máy Windows thứ hai để nó tự kiểm tra và sửa cấu hình.

Nhưng cần hiểu đúng: file `.md` không tự đồng bộ dữ liệu. Codex Desktop agent đọc tài liệu này, sau đó thực hiện các bước cần thiết như kiểm tra `CODEX_HOME`, sửa `.env.local`, khởi động Windows bridge, và cấu hình `config.toml`. Sau khi Windows bridge chạy đúng, việc đồng bộ sẽ diễn ra tự động.

Luồng đúng là:

```text
Codex Desktop sessions trên PC
  -> Windows bridge đọc CODEX_HOME/sessions/**/*.jsonl
  -> bridge gửi snapshot lên VPS qua /agent/snapshot
  -> Codex Chat Mobile đọc /api/codex-chat và hiển thị thread
```

Điện thoại không đọc trực tiếp file Codex trên PC. Tất cả thread đều đi qua Windows bridge.

## Prompt đưa cho Codex Desktop

Mở Codex Desktop trên máy Windows đang có Codex sessions, rồi đưa yêu cầu này:

```text
Hãy đọc file docs/CODEX_CHAT_SYNC.md trong repo codex-mobile-app-one-api-to-rule-them-all và cấu hình máy này để đồng bộ Codex Desktop threads lên Codex Mobile App.

Yêu cầu:
- Không in token đầy đủ ra màn hình.
- Không xoá session Codex.
- Tìm đúng CODEX_HOME đang có thư mục sessions.
- Sửa .env.local nếu sai.
- Khởi động hoặc restart Windows bridge.
- Kiểm tra `config.toml` không còn `wire_api = "chat"`; nếu có thì đổi thành `wire_api = "responses"`.
- Kiểm tra bridge online trên VPS.
- Kiểm tra Codex Chat Mobile có thấy thread.
- Nếu cần, đọc thêm docs/CODEX_DESKTOP_AGENT_REPAIR.md.
```

## Điều kiện bắt buộc

1. VPS đã cài Codex Mobile App và mở được domain HTTPS.
2. Máy Windows đã có Codex Desktop hoặc Codex CLI hoạt động được.
3. Windows bridge đã được cài theo `docs/WINDOWS_BRIDGE.md`, hoặc Codex Desktop agent sẽ tự cài/sửa theo tài liệu này.
4. File `.env.local` trên máy Windows có đúng các giá trị sau:

```text
TICMIRO_SERVER_URL=https://your-domain.example
TICMIRO_AGENT_TOKEN=<windows-bridge-token>
CODEX_HOME=<thư mục Codex đang dùng>
TICPROXY_BASE_URL=https://your-domain.example/v1
TICPROXY_API_KEY=<proxy-api-key>
TICMIRO_CODEX_BIN=<đường dẫn codex.exe/codex.cmd nếu codex không nằm trong PATH>
```

## Bước dễ bị bỏ sót: cài Codex CLI trên máy local

TicProxy Mobile không tự cài Codex vào PC. Máy Windows phải có `codex` chạy được trước, vì bridge cần gọi:

```text
codex exec
codex app-server
```

Kiểm tra:

```powershell
node -v
npm -v
codex --version
codex app-server --help
```

Nếu `codex` chưa có, cài theo hướng dẫn OpenAI trên Windows:

```powershell
npm i -g @openai/codex
codex --version
codex app-server --help
```

Nếu bạn dùng Codex Desktop bản Windows và `codex` không nằm trong PATH, tìm `codex.exe` thật:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 -ExpandProperty FullName
```

Sau đó thêm vào `.env.local`:

```env
TICMIRO_CODEX_BIN=C:\Users\<you>\AppData\Local\OpenAI\Codex\bin\<version>\codex.exe
```

## Lưu ý quan trọng về Codex mới

Không được cấu hình:

```toml
wire_api = "chat"
```

Các bản Codex mới không còn hỗ trợ `wire_api = "chat"`. Nếu để dòng này trong `C:\Users\<you>\.codex\config.toml`, Codex Desktop có thể báo lỗi:

```text
failed to load configuration:
wire_api = "chat" is no longer supported.
How to fix: set wire_api = "responses" in your provider config.
```

Cấu hình đúng cho TicProxy phải là:

```toml
[model_providers.ticproxy]
name = "TicProxy"
base_url = "https://your-domain.example/v1"
env_key = "TICPROXY_API_KEY"
wire_api = "responses"
```

Nếu Windows bridge đang online, cách nhanh nhất là vào `TicProxy -> API ONE KEY` trên mobile. Bridge sẽ backup `config.toml`, ghi block `model_providers.ticproxy`, đặt `model_provider = "ticproxy"` và lưu `TICPROXY_API_KEY` vào Windows User env. Khi UI báo `Đã cấu hình TicProxy xong`, user chủ động bấm `Refresh Desktop` để khởi động lại Codex Desktop và áp dụng cấu hình mới.

Nếu Codex Desktop đang lỗi không chat được, chạy PowerShell:

```powershell
$Config = "$env:USERPROFILE\.codex\config.toml"
Copy-Item $Config "$Config.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
(Get-Content $Config) `
  -replace 'wire_api\s*=\s*"chat"', 'wire_api = "responses"' |
  Set-Content $Config -Encoding UTF8
```

Sau đó thoát hẳn Codex Desktop và mở lại.

## Cách kiểm tra trên mobile

1. Mở webapp:

```text
https://your-domain.example/?token=<Mobile token>
```

2. Vào tab `Agent PC`.
3. Kiểm tra bridge đang `online`.
4. Kiểm tra `Codex home` đúng với máy Windows.
5. Kiểm tra capability có các dòng:

```text
codex.thread.sync
codex.thread.read
codex.thread.send
codex.desktop.restart
oauth.callback.relay
```

6. Vào tab `Codex Chat`.
7. Bấm refresh/snapshot nếu danh sách thread chưa hiện.
8. Chọn thread cần đọc.
9. Bấm `Read` nếu muốn lấy transcript mới nhất.
10. Gửi thử tin nhắn trong thread đã chọn.

Khi gửi tin nhắn, server tạo command `codex.thread.send`. Windows bridge sẽ gọi Codex app-server bằng `thread/resume` và `turn/start` để gửi vào thread Desktop đã chọn.

## Nếu Mobile gửi được nhưng Codex Desktop chưa tự cập nhật

Một số bản Codex Desktop trên Windows chưa tự reload UI khi file `sessions/**/*.jsonl` thay đổi từ bridge. Khi đó tin nhắn đã được gửi vào thread đúng, nhưng cửa sổ Desktop chỉ hiện phiên mới sau khi bạn thoát và mở lại Codex.

Cách dùng ổn định hiện tại:

1. Trên mobile, vào `Codex Chat`.
2. Chọn thread đang làm việc.
3. Sau khi gửi tin nhắn hoặc khi cần kéo UI Desktop về trạng thái mới, bấm `Refresh Desktop`.

Nút này tạo command:

```text
codex.desktop.restart
```

Windows bridge sẽ đóng và mở lại Codex Desktop trên PC đang chạy bridge. Không cần mở Task Manager.

TicProxy không tự reopen Codex Desktop sau mỗi tin nhắn mobile. Cách đó gây giật UI, dễ làm rơi trạng thái đang nhập, và làm người dùng tưởng Codex Desktop bị lỗi. Chỉ bấm `Refresh Desktop` khi thật sự cần kéo cửa sổ Desktop về trạng thái mới.

Sau khi cập nhật bridge, restart bridge:

```powershell
Stop-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "Codex Mobile App Bridge"
```

Nếu bridge không tìm được launcher Codex Desktop, cấu hình thủ công một trong hai biến:

```env
TICMIRO_CODEX_DESKTOP_BIN=C:\Users\<you>\AppData\Local\Programs\Codex\Codex.exe
TICMIRO_CODEX_DESKTOP_RESTART_COMMAND=Stop-Process -Name Codex -Force; Start-Process "C:\Path\To\Codex.exe"
```

TicProxy bridge hiện đã ưu tiên nói chuyện với một Codex app-server host do bridge quản lý lâu dài. Sau khi `turn/completed`, bridge đợi `sessions/**/*.jsonl` cập nhật rồi publish snapshot sạch lên VPS. `Refresh Desktop` chỉ là nút cứu UI nếu cửa sổ Desktop đang mở chưa live-reload.

## Bài học từ Codex Mobile chính thức

Trang Codex Mobile chính thức của OpenAI mô tả mobile là nơi bắt đầu, điều phối, phê duyệt và theo dõi công việc trong khi Codex vẫn chạy trên laptop, Mac mini hoặc máy tính từ xa. Mobile không tự sở hữu workspace; nó dùng tệp, plugin, trạng thái dự án và cấu hình đã có trên máy host.

Tài liệu `Remote connections` của OpenAI nói rõ remote access dùng projects, threads, files, credentials, permissions, plugins, Computer Use, browser setup và local tools từ host đã kết nối. Điện thoại gửi prompt, approval và follow-up; host cung cấp môi trường chạy lệnh, file, browser, desktop apps và security controls. Kết nối đi qua secure relay, không mở app-server trực tiếp ra internet.

Ghi chú quan trọng tại thời điểm cập nhật tài liệu này: mobile setup chính thức đang yêu cầu Codex App for macOS; Codex App for Windows chưa hỗ trợ mobile setup. Vì TicProxy đang tập trung Windows, hướng đúng trước mắt là:

- Windows bridge giữ vai trò host agent luôn online.
- Mobile gửi command vào bridge qua VPS relay.
- Bridge ưu tiên nói chuyện với app-server/host session đang sống, stream trạng thái và publish snapshot sạch.
- Không restart Codex Desktop tự động sau từng tin nhắn.
- `Refresh Desktop` chỉ là thao tác thủ công khi UI Desktop chưa live-reload.

## Host app-server của bridge

Mặc định trên Windows, bridge dùng app-server theo từng lượt gửi để ổn định hơn:

```env
TICMIRO_CODEX_APP_SERVER_MODE=per-command
TICMIRO_THREAD_SNAPSHOT_WAIT_MS=15000
TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000
```

Luồng gửi tin:

```text
Mobile -> VPS command queue -> Windows bridge
  -> Codex app-server host
  -> thread/resume
  -> turn/start
  -> publish snapshot mỗi vài giây khi turn đang chạy
  -> turn/completed
  -> đợi sessions/**/*.jsonl cập nhật
  -> publish snapshot sạch về VPS
```

Nhờ vậy mobile không còn cảm giác “không nhận phản hồi” khi Codex đang trả lời lâu. Command vẫn chỉ `completed` khi turn thật sự xong, nhưng thread list/transcript/progress snapshot được đẩy lên VPS trong lúc chờ.

Nếu muốn thử host chạy lâu, có thể bật experimental:

```env
TICMIRO_CODEX_APP_SERVER_MODE=managed
```

Sau khi đổi `.env.local`, restart bridge.

## Nếu không thấy thread

Khả năng cao nhất là sai `CODEX_HOME`.

Các thư mục thường gặp:

```text
C:\Users\<you>\.codex
C:\Users\<you>\AppData\Local\OpenAI\Codex\codex-home
C:\Users\<you>\AppData\Roaming\Codex\codex-home
```

Tìm thư mục nào có:

```text
sessions
config.toml
```

Sau đó sửa `.env.local`:

```text
CODEX_HOME=<thư mục có sessions>
```

Restart scheduled task:

```powershell
Stop-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "Codex Mobile App Bridge"
```

Nếu scheduled task chưa tồn tại, chạy lại installer:

```powershell
cd "$env:USERPROFILE\codex-mobile-app-one-api-to-rule-them-all"
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-bridge.ps1 -RunNow
```

## Nếu thread hiện `<environment_context>` hoặc đường dẫn thư mục

Nguyên nhân thường là Windows bridge đang đọc nhầm context/tool output nội bộ từ:

```text
CODEX_HOME/sessions/**/*.jsonl
```

Dấu hiệu thường thấy:

- Thread trên mobile chỉ hiện `<environment_context>...</environment_context>`.
- Thread title hoặc tin nhắn đầu tiên chỉ là đường dẫn thư mục.
- Transcript có tool call output, patch output, log terminal, hoặc token/env key.

Cách sửa:

1. Cập nhật Windows bridge lên bản mới nhất:

```powershell
cd "$env:USERPROFILE\codex-mobile-app-one-api-to-rule-them-all"
git pull --ff-only
```

Nếu thư mục này được cài từ file zip/bootstrap và không có `.git`, chạy lại bootstrap hoặc tải lại repo mới nhất từ GitHub.

2. Restart bridge:

```powershell
Stop-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "Codex Mobile App Bridge"
```

3. Trên mobile, bấm `Sync`/`Reload`.

Bridge bản mới phải bỏ qua trước khi publish snapshot:

- `<environment_context>...</environment_context>`,
- tool call output,
- patch output,
- terminal/tool logs,
- các token hoặc env key nhạy cảm.

Nếu sau khi cập nhật vẫn còn lỗi, kiểm tra bridge log:

```powershell
Get-Content "$env:USERPROFILE\codex-mobile-app-one-api-to-rule-them-all\runtime\logs\windows-bridge.log" -Tail 120
```

## Khác nhau giữa sync thread và codex exec

`Codex Chat Sync` đọc và gửi tiếp vào thread Codex Desktop đã có.

`codex exec` tạo một tác vụ CLI riêng. Nó không phải là cách để lấy các cuộc trò chuyện đang mở trong Codex Desktop.

Vì vậy, nếu mục tiêu là thấy lại các cuộc trò chuyện Desktop trên mobile, hãy kiểm tra `Codex Chat Sync` và `CODEX_HOME`, không chỉ kiểm tra `codex exec`.

## OAuth callback cũng đi qua bridge

Khi bridge chạy, nó mở local callback relay trên:

```text
Codex / ChatGPT: http://localhost:1455/auth/callback
Gemini CLI:      http://localhost:8085/oauth2callback
Antigravity:     http://localhost:51121/oauth-callback
```

Vào `TicProxy -> OAuth`, tạo link đăng nhập và mở link trên chính PC đang chạy bridge. Sau khi provider redirect về `localhost`, bridge sẽ tự gửi callback về VPS qua `/agent/oauth-callback`. Trên mobile, trang OAuth sẽ tự đổi trạng thái và hiện account đã lưu.

Nếu mở link trên điện thoại, `localhost` sẽ là điện thoại, không phải PC. Khi đó auto callback không chạy. Hãy mở link trên PC, hoặc copy URL localhost cuối cùng có `code=...&state=...` và dán vào phần `Nhập callback thủ công`.
