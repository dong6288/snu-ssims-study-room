# 설치와 모의 시험

## Windows에서 설치

공식 Chrome 확장을 사용할 수 있는 ChatGPT 데스크톱과 Chrome을 준비합니다. [브라우저 확장 안내](https://learn.chatgpt.com/docs/chrome-extension)

1. 저장소 소스 ZIP을 풀거나 저장소를 복제합니다.
2. 저장소 루트에서 PowerShell로 아래 명령을 실행합니다.

```powershell
.\Install-SnuStudyRoom.ps1
```

기본 설치 위치는 `%USERPROFILE%\.agents\skills`입니다. 설치 파일이 이미 같으면 경로를 돌려줍니다. 기존 파일이 다르면 기존 설치를 보존하고 종료합니다. 별도 시험 위치는 절대 경로로 `-SkillHome`을 지정합니다.

3. 새 Codex 채팅에서 `@Chrome`과 `$snu-ssims-study-room`을 선택합니다. 방금 설치한 스킬을 현재 채팅이 보지 못하면 새 채팅을 열거나 앱을 다시 시작합니다.

다운로드한 스크립트에 서명 또는 실행 정책 오류가 뜨면 기본 제공 `$skill-installer`로 설치합니다. [Codex 스킬 문서](https://learn.chatgpt.com/docs/build-skills)

```text
$skill-installer dong6288/snu-ssims-study-room의 skills/snu-ssims-study-room을 사용자 .agents/skills에 설치해줘.
```

## 무료 예약 신청 준비

Node.js 24 이상에서 설치된 스킬의 `scripts/attempts.mjs`를 인자로 전달해 빈 로컬 기록을 초기화합니다. 아래 경로는 기본 설치 기준입니다.

```powershell
$skillPath = Join-Path $HOME '.agents/skills/snu-ssims-study-room'
node (Join-Path $skillPath 'scripts/attempts.mjs') init
```

다른 경로로 설치했다면 `$skillPath`를 실제 설치 경로로 설정합니다. 출력 `status: ready`는 로컬 기록이 준비됐다는 뜻입니다. 로컬 기록 위치와 복구 절차는 [시도 기록 안내](../skills/snu-ssims-study-room/references/journal.md)를 따릅니다. 조회는 초기화 없이 사용할 수 있습니다.

## 모의 시험

Node.js 24 이상에서 저장소 루트로 이동합니다. Chrome이 기본 Windows 경로에 없으면 모의 시험 명령의 마지막 인자로 `chrome.exe` 절대 경로를 지정합니다.

```powershell
node --test tests/attempts.test.mjs
$mockHome = Join-Path $env:TEMP ('snu-ssims-test-' + [Guid]::NewGuid().ToString('N'))
$installed = .\Install-SnuStudyRoom.ps1 -SkillHome $mockHome
node tests/mock-booking.mjs $installed
```

모의 시험은 설치된 스킬에서 기록 모듈을 불러오고, 가상 Chrome 화면으로 로그인 인계·전체 페이지 탐색·신청서 재확인·신청·확정 응답을 재현합니다. 승인 이후 양식이 바뀌면 클릭하지 않고, 제출 직후 결과를 읽을 수 없으면 새 실행에서도 중복 신청을 막습니다. 브라우저는 임시 프로필을 사용하며 학교 계정·서비스에 접속하지 않습니다. 이 시험은 Codex 모델의 자연어 판단이나 실제 예약 서버 전이를 대신 검증하지 않습니다.
