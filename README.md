# SNU Study Room

서울대 공대생이 Chrome의 **예약하샤**에서 스터디룸을 찾고 무료 예약 신청을 준비하는 Codex 스킬입니다. 본인이 쓰는 Chrome 프로필로 접속하고, 신청서는 학생이 확인한 뒤 한 건만 제출합니다. [예약하샤](https://ssims.snu.ac.kr/index.do) · [서울대 정보화본부 안내](https://ist.snu.ac.kr/%EA%B3%B5%EA%B0%84%EA%B4%80%EB%A6%AC%EC%98%88%EC%95%BD%ED%95%98%EC%83%A4/)

## Windows 설치

1. [GitHub 소스 ZIP](https://github.com/dong6288/snu-ssims-study-room/archive/refs/heads/main.zip)을 받아 압축을 풉니다.
2. 압축을 푼 폴더의 PowerShell에서 `.\Install-SnuStudyRoom.ps1`을 실행합니다. 설치 경로가 출력됩니다. 서명 또는 실행 정책 오류가 뜨면 Codex의 `$skill-installer` 경로를 사용합니다.
3. ChatGPT 데스크톱의 **Codex 채팅**을 새로 열고, 공식 확장이 연결된 실제 `@Chrome`을 선택합니다. [Chrome 연결 안내](https://learn.chatgpt.com/docs/chrome-extension)
4. 예약 신청까지 맡기려면 Node.js 24 이상에서 [신청 기록을 초기화](docs/INSTALL.md#무료-예약-신청-준비)합니다. 조회만 할 때는 Node 설치와 초기화가 필요 없습니다.

Codex의 `$skill-installer`로 설치할 때는 `dong6288/snu-ssims-study-room` 저장소의 `skills/snu-ssims-study-room`을 지정하세요. [세부 설치법과 검증](docs/INSTALL.md)

## 사용 예시

```text
@Chrome $snu-ssims-study-room 금요일 16~18시 관악 전체에서 4명 스터디룸을 찾아줘. 모니터는 필수야. 검색만 해줘.
```

```text
@Chrome $snu-ssims-study-room 다음 주 화요일 오후 2~4시, 4명이 팀 발표 연습할 무료 스터디룸 한 곳을 신청해줘. 43-2동을 선호해.
```

건물을 지정하지 않으면 해당 캠퍼스의 결과를 끝까지 읽습니다. 캠퍼스를 생략하면 관악을 검색하고, `전체 캠퍼스`라고 하면 현재 계정에 표시되는 캠퍼스 탭을 순회합니다. 공간 이름, 대관 목적, 이용 자격, 운영시간, 인원과 장비를 확인합니다. 검색에 나온 공간이나 비어 보이는 달력 칸만으로 예약 가능이라고 판단하지 않습니다. [Chrome 작업 흐름](skills/snu-ssims-study-room/references/ssims.md)

로그인이 필요하면 열린 Chrome에서 학생이 직접 로그인합니다. 예약 신청에는 학생의 참가자 인증과 필수 동의, 완성된 신청서에 대한 확인이 필요합니다. 제출 직전 로컬 기록을 남기고, 공식 응답이나 새 예약 내역에서 접수·승인 대기·확정을 구분합니다. 중간에 종료되면 공식 기록 확인 전까지 같은 요청을 보류합니다. 유료 공간의 신청과 결제, 중앙도서관 시설예약은 각각 공식 화면과 [중앙도서관 앱](https://lib.snu.ac.kr/about/mobile/mobile-pass/)으로 안내합니다.

## 검증

로컬 시험은 로컬 기록의 상태 전이와 중복 신청 방지를 확인합니다. Chrome 모의 시험은 별도 임시 Chrome 프로필과 가상 화면에서 로그인, 두 페이지 조회, 내용 확인, 신청 1회, 모의 확정과 응답 지연 뒤 재신청 보류를 재현합니다. 서울대 실서비스에서는 읽기 전용으로 검색과 신청서 열기를 확인했습니다. 실제 예약 제출과 서버의 확정 처리는 모의 시험 범위 밖입니다. [재현 명령](docs/INSTALL.md#모의-시험) · [데이터 처리](PRIVACY.md)
