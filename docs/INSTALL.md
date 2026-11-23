# 설치와 모의 시험

빈 시간 **조회에는 Node.js가 필요 없습니다.** 무료 예약 **신청**까지 맡길 때만 Node.js 24 이상과 신청 기록이 필요합니다.

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

## Windows에서 업데이트

기존 스킬 폴더 `%USERPROFILE%\.agents\skills\snu-ssims-study-room`을 `.agents\skills` 밖의 백업 위치로 옮긴 뒤 새 ZIP에서 위 설치 절차를 실행합니다. 설치에 실패하면 기존 폴더를 원래 위치에 돌려놓을 수 있습니다. 새 Codex 채팅에서 스킬을 열어 확인합니다. 신청 기록은 `%LOCALAPPDATA%\SnuSsimsStudyRoom`에 별도로 있으므로 그대로 둡니다.

## 무료 예약 신청 준비

이 PC에서 처음 무료 신청을 설정할 때만 새 기록을 초기화합니다. 먼저 `node --version`이 24 이상인지 확인하세요. 아래는 기본 설치 경로 기준입니다.

```powershell
$skillPath = Join-Path $HOME '.agents/skills/snu-ssims-study-room'
node (Join-Path $skillPath 'scripts/attempts.mjs') init
```

다른 경로로 설치했다면 `$skillPath`를 실제 설치 경로로 설정합니다. 기존 기록을 확인하려면 같은 명령의 `init`을 `status`로 바꾸세요. `ready`는 기록을 읽을 수 있다는 뜻입니다. 같은 시간대의 접수 여부는 예약하샤에서 확인합니다. 이전 신청에 쓰던 기록이 사라졌거나 출처가 불분명하면 기존 기록을 복구하거나 공식 내역을 먼저 확인하세요. [시도 기록 안내](../skills/snu-ssims-study-room/references/journal.md)

## 모의 시험

Node.js 24 이상에서 저장소 루트로 이동합니다. Chrome이 기본 Windows 경로에 없으면 모의 시험 명령의 마지막 인자로 `chrome.exe` 절대 경로를 지정합니다.

```powershell
node --test tests/attempts.test.mjs
$mockHome = Join-Path $env:TEMP ('snu-ssims-test-' + [Guid]::NewGuid().ToString('N'))
$installed = .\Install-SnuStudyRoom.ps1 -SkillHome $mockHome
node tests/mock-booking.mjs $installed
```

모의 시험은 설치된 스킬에서 기록 모듈을 불러오고, 가상 Chrome 화면으로 로그인 인계·전체 페이지 탐색·기록 준비 확인·신청서 재확인·신청·확정 응답을 재현합니다. 승인 이후 양식이 바뀌면 클릭하지 않습니다. 제출 뒤 응답이 끊기는 경우에는 스킬이 제출한 경우와 학생이 직접 누른 경우를 각각 모의하고 새 실행에서 중복 신청을 막는지 확인합니다. 브라우저는 임시 프로필을 사용하며 학교 계정·서비스에 접속하지 않습니다. 이 시험은 Codex 모델의 자연어 판단이나 실제 예약 서버 전이를 대신 검증하지 않습니다.
