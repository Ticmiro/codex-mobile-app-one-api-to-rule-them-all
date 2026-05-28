# App Auther Setup

Sau khi chay script cai VPS, mo domain da cai dat kem `Mobile token`, vi du:

```text
https://codex.example.com/?token=<Mobile token>
```

Vai tro cac gia tri installer in ra:

- `Mobile token`: de xem dashboard va dieu khien Windows bridge.
- `Windows bridge token`: chi dan vao installer Windows bridge.
- `Proxy API key`: API key ma Codex/Gemini/Antigravity/app khac se dung voi `/v1`.
- `Admin token`: chi dung cho API quan tri nang cao, khong bat nguoi moi nhap tren UI.

## Luong dung hien tai

Ban mo ta dung gan het:

1. May Windows cua user da co Codex Desktop/Codex CLI.
2. Cai `Codex Mobile + TicProxy` len VPS va tro domain ve VPS.
3. Mo web app tren domain bang `?token=<Mobile token>`.
4. Vao tab `TicProxy` de OAuth login, import auth JSON, xem quota, providers, config, logs, info.
5. Dung mot `Proxy API key` cua TicProxy cho Codex, Antigravity, Gemini CLI, app mobile, hoac app khac.
6. Tren may Windows, mo Codex Desktop va dua file `docs/CODEX_DESKTOP_AGENT_REPAIR.md` cho agent doc de tu sua bridge, `.env.local`, va `config.toml`.

Luu y quan trong: `Proxy API key` la key cua server TicProxy cua ban. Mot key nay co the dung cho nhieu app. Phia sau key do, server se route qua nhieu account/provider ma ban da them.

## Trang thai Auther/OAuth that

Hien tai Auther da co khung OAuth Authorization Code + PKCE, callback, refresh token, account pool, quota va routing. Tuy nhien link dang nhap OAuth chi tao duoc khi provider co du cau hinh OAuth that:

- `Authorization URL`
- `Token URL`
- `Client ID`
- scope/secret/extra params neu provider yeu cau

Provider trong `TicProxy -> OAuth` co san preset cho `Codex / ChatGPT`, nen bam `Start OAuth` phai tao link ngay. `Gemini CLI` va `Antigravity` cung co preset callback/scope, nhung Google OAuth client ID/secret phai duoc dien qua bien moi truong hoac `data/providers.json`; GitHub khong cho ship cac gia tri nay trong repo public.

Neu ban chon provider custom trong `data/providers.json` ma provider do chua dien endpoint/client that cua adapter, bam `Start OAuth` se bao thieu cau hinh va khong co link dang nhap. Day la hanh vi dung; khong phai VPS treo.

De test tu dau ngay bay gio, dung luong `Add API-key Account` ben duoi. Luong API-key account da san sang dung voi `/v1` va `Proxy API key`.

Neu provider login yeu cau callback tren may local, de Codex Desktop/Windows agent dang nhap cuc bo roi dan token JSON vao `Import Auth JSON`. App se luu file auth tren VPS va tao account trong pool.

TicProxy community ho tro relay callback local qua Windows bridge. Webapp tu dien ngam callback mac dinh theo platform, nguoi dung pho thong khong can nhap tay:

- Codex / ChatGPT: `http://localhost:1455/auth/callback`
- Gemini CLI: `http://localhost:8085/oauth2callback`
- Antigravity: `http://localhost:51121/oauth-callback`

Dieu kien de auto callback chay: mo link OAuth tren dung PC dang chay Windows bridge. Bridge se bat callback `localhost` va gui ve VPS qua `/agent/oauth-callback`. Neu mo link tren dien thoai, `localhost` la dien thoai nen bridge khong bat duoc; khi do mo `Nhap callback thu cong`, dan URL cuoi cung co `code=...&state=...`, roi bam `Submit`.

## Man hinh chinh sau khi dang nhap

Ung dung khong chi la menu cai dat. Cac tab chinh can test theo thu tu:

1. `Codex Chat`: xem danh sach thread Codex Desktop do Windows bridge dong bo, chon thread, doc transcript va gui tin nhan tiep vao thread do.
2. `TicProxy`: quan ly OAuth, auth files, quota, providers, config, logs va thong tin base URL `/v1`.
3. `Agent PC`: xem Windows bridge co online khong, Codex bin/home la gi, allowed folders nao duoc phep chay, queue lenh, file controls va task controls.

## Cai nhanh bang API key

Day la duong di nen test truoc sau khi cai, vi khong phu thuoc provider OAuth.

1. Dung `Admin token` goi API `/admin/accounts`, hoac sua `data/providers.json` tren VPS de them API-key account.
2. Mo tab `TicProxy -> Providers` de kiem tra provider/model.
3. Mo tab `TicProxy -> Info` de copy base URL `/v1`.
4. Test model list:

```bash
curl https://codex.example.com/v1/models \
  -H "Authorization: Bearer <Proxy API key>"
```

Duong cu van dung duoc:

1. Mo `TicProxy -> Auth Files`.
2. Dan auth/token JSON tin cay vao `Upload Text`.
3. Bam `Upload Text`.
4. Mo `TicProxy -> Quota` de kiem tra account moi.

Neu probe OK, cau hinh Codex dung:

```text
Base URL: https://codex.example.com/v1
API key: <Proxy API key installer da in ra>
```

Sau do co the quay lai tab `Codex Chat` de xem/giao tiep voi thread Codex Desktop da dong bo qua Windows bridge.

Huong dan dong bo chi tiet: `docs/CODEX_CHAT_SYNC.md`.

## Test ket noi that cua TicProxy

Quota check chi doc han muc tai khoan; no khong dam bao account goi duoc `/v1/responses`. De bat loi 401 som:

1. Mo tab `Agent PC`.
2. O `TicProxy Connection Test`, chon `Auto route` hoac mot account cu the.
3. Nhap model, vi du `gpt-5.5`.
4. De prompt mac dinh `Reply exactly: TICPROXY_CONNECTION_OK` hoac nhap prompt ngan khac.
5. Bam `Test`.

Ket qua hien status code, provider/account/email, route mode, model upstream, latency, output hoac error upstream. Voi `Codex / ChatGPT` OAuth, route mode dung la `codex-cli-oauth` va upstream dung `https://chatgpt.com/backend-api/codex/responses`. Neu route mode thanh `openai-compatible` va upstream la `https://api.openai.com/v1/responses`, token OAuth Codex se bi 401 vi thieu scope `api.responses.write`.

Luu y: duong goi model chinh thuc cua TicProxy la account tao qua `OAuth Login` hoac provider API key OpenAI-compatible.

## Test PC Agent / Codex CLI

PC Agent chi hoat dong khi Windows bridge da cai tren may Windows dang co Codex CLI.

1. Cai Windows bridge theo `docs/WINDOWS_BRIDGE.md`.
2. Mo tab `Agent PC`.
3. Kiem tra `Last seen`, `Codex bin`, `Codex home`, va `Allowed roots`.
4. Nhap prompt vao `Task Controls`.
5. Neu can thao tac tren repo/local file, dien `Workspace cwd`; path nay phai nam trong `Allowed roots`.
6. Bam `Run via Agent`.
7. Xem ket qua trong `Command Queue`.

## Sync voi Codex Desktop

Codex Chat Mobile khong tu doc duoc cac cuoc tro chuyen dang co tren Codex Desktop. Viec nay do Windows bridge xu ly, vi bridge chay tren dung PC co `CODEX_HOME`.

Luong sync:

```text
Codex Desktop sessions -> Windows bridge -> VPS snapshot -> Mobile Codex Chat
```

Trong tab `Codex Chat`:

1. Bam `Phiên` neu danh sach thread dang an tren mobile.
2. Chon thread Desktop can xem.
3. Bam `Read` neu can refresh transcript.
4. Tin nhan hien ra tu `CODEX_HOME/sessions/**/*.jsonl`.
5. Khi gui tin nhan, server tao command `codex.thread.send`.
6. Windows bridge goi Codex app-server bang `thread/resume` va `turn/start` de gui vao thread da chon.

Luu y: `PC Agent Codex CLI` va `Desktop Thread Sync` khac nhau. `PC Agent Codex CLI` dung `codex exec` va tao mot tac vu CLI rieng. `Desktop Thread Sync` moi la duong de doc/gui vao thread Codex Desktop da co.

## Cai Auther OAuth

OAuth can provider cong khai cac endpoint OAuth hoac ban tu co OAuth app/client cua provider do. Trong app:

1. Mo tab `AI Providers`.
2. Bat `Enable OAuth / PKCE`.
3. Dien:
   - `Authorization URL`
   - `Token URL`
   - `Profile URL` neu provider co endpoint userinfo
   - `Client ID`
   - `Client secret` neu provider yeu cau
   - `Scopes`
4. Bam `Save provider`.
5. Mo tab `Auther Login`.
6. Chon provider va bam `Start OAuth`.
7. Dang nhap tren trang provider.
8. Provider redirect ve:

```text
https://codex.example.com/oauth/callback
```

Callback thanh cong se luu account vao VPS cua ban. Sau do Codex chi dung mot `Proxy API key`; server tu route qua account pool.

## Import Auth JSON

Day la duong dung khi login provider phai chay tren may Windows local.

1. Tren may Windows co Codex Desktop, de agent/local helper dang nhap provider va xuat token JSON hop le.
2. Mo webapp TicProxy.
3. Vao `Auther Login`.
4. O khung `Import Auth JSON`, chon provider.
5. Dan token JSON vao o `Auth/token JSON`.
6. Bam `Import auth`.
7. Kiem tra account moi trong `Accounts Pool`.

Server se luu file auth trong `runtime/server/auth` tren VPS, dong thoi tao account trong `data/providers.json`. UI chi hien metadata, khong hien token ra lai.

Luong nay dung local helper tao auth file, con TicProxy server dung account do de route `/v1`.

## Quota va routing

Tab `Quota & Routing` hien:

- request/token theo tung account trong ngay,
- loi gan nhat,
- `Routes JSON` de pin model vao provider/upstream model/account strategy.

Vi du route:

```json
{
  "default-fast": {
    "provider": "openai-main",
    "model": "gpt-5.4-mini",
    "accountStrategy": "least-used"
  }
}
```

## Luu y cho nguoi dung pho thong

- `Admin token` la khoa quan tri. Khong gui cho nguoi khac.
- `Proxy API key` la khoa dua vao Codex. Neu lo key, doi key trong file `.env` tren VPS va restart container.
- Provider API key va OAuth token duoc luu trong `data/providers.json` tren VPS cua ban. Hay backup va bao ve VPS.
- Neu OAuth provider chua co thong tin endpoint/client hop le, hay dung API-key account de test truoc.
