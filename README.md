<p align="center">
  <img src="docs/logo.png" alt="MARKO" width="400">
</p>

<p align="center">
  <strong>한국어 논문 글쓰기용 로컬 마크다운 뷰어</strong><br>
  AI와 협업하는 조용한 읽기·주석 도구
</p>

---

크롬에서 `.md` 파일을 드래그하면 논문처럼 렌더됩니다. 세로 3단 레이아웃 · 수식 · 목차 · 형광펜 · 텍스트 앵커 메모 · 파일별 설정. 원본 `.md` 파일은 수정하지 않습니다.

---

## 특징

- **3단 레이아웃**: 좌측 목차 | 중앙 본문 | 우측 그림·메모 패널
- **KEI editorial 스타일**: Distill 풍의 조용한 타이포, cream 배경 + navy 본문
- **오프라인 번들**: Paperlogy, Pretendard Variable, KaTeX 폰트 전부 포함. 인터넷 없이 작동
- **수식 렌더링**: `$inline$`, `$$display$$`, `\[...\]`, `\(...\)` — KaTeX
- **각주**: `본문[^1]` + `[^1]: 설명` 패턴 지원
- **형광펜**: 파스텔 5색 + 찐 형광 3색 + 글자색 3색
- **메모 앵커**: 본문 선택 → 📝 클릭 → 인라인 입력 → 우측 패널에 섹션별로 정렬. 클립보드 복사 · 본문 위치 양방향 이동
- **파일별 설정**: 폰트·크기·테마를 각 `.md` 파일마다 따로 저장
- **실시간 재로드**: 원문 `.md` 파일이 외부 에디터에서 변경되면 자동 감지 후 새로고침 (스크롤 위치 유지)
- **한글 가독성 우선**: Paperlogy 번들 · 한글/영문 폰트 분리 설정
- **안전한 저장**: 형광펜·메모는 `chrome.storage.local` 에 저장, 원본 `.md` 는 건드리지 않음

---

## 설치 (개발자 모드)

크롬 웹스토어 배포 전 단계라 수동 설치가 필요합니다.

1. 이 저장소 클론 또는 ZIP 다운로드
   ```bash
   git clone https://github.com/kkhgeo/Marko-viewer.git
   ```
2. 크롬 주소창에 `chrome://extensions` 열기
3. 우측 상단 **개발자 모드** 토글 ON
4. 좌측 상단 **"압축해제된 확장 프로그램 로드"** 클릭
5. 클론한 폴더 선택
6. 설치된 **MARKO** 카드에서 **"파일 URL에 대한 액세스 허용"** 토글 ON ⚠️ **필수**
7. 로컬 `.md` 파일을 크롬으로 열면 자동 렌더링

---

## 사용법

### 기본
- 탐색기에서 `.md` 파일을 크롬 창으로 드래그 → 렌더됨
- 또는 주소창에 `file:///Z:/path/to/file.md` 직접 입력

### 단축키
| 키 | 동작 |
|---|---|
| `T` | 좌측 목차 토글 |
| `F` | 우측 그림·메모 패널 토글 |
| `D` | 다크모드 토글 |
| `Esc` | 팔레트 / 인라인 에디터 닫기 |

### 형광펜 / 글자색
1. 본문 텍스트 드래그 선택
2. 떠오른 팔레트에서 색 클릭
3. `✕` 로 해당 선택의 색 제거

### 메모 앵커
1. 본문 텍스트 드래그
2. 팔레트의 **메모** 버튼 클릭
3. 선택 위치 옆 인라인 박스에 타이핑
4. **Ctrl+Enter** (또는 저장 버튼) → 커밋
5. 본문에 `[1]` 뱃지 + 우측 패널에 메모 카드 생성
6. 뱃지 ↔ 카드 양방향 클릭으로 이동

### 설정
우하단 ⚙ 아이콘 → 인라인 드로어 열림
- 조정한 값은 즉시 이 파일에 저장
- **현재 설정을 기본값으로 저장** — 모든 파일의 기본값 갱신 (확인 대화상자 거침)
- **이 파일 설정 초기화** — 개별 설정 제거, 기본값 따라감

### 이미지 참조
같은 폴더의 이미지는 상대 경로로
```markdown
![캡션](figure.png)
```
또는 `file://` 절대 경로
```markdown
![캡션](file:///Z:/research/paper/fig1.png)
```
이미지는 섹션 단위로 자동 그룹화되어 우측 패널에 표시됩니다.

---

## 구성

```
Marko-viewer/
├── manifest.json         # MV3, file:// 매칭, permissions
├── background.js         # 서비스 워커 (옵션 페이지 open 처리)
├── content.js            # 핵심 — 파싱·렌더·형광펜·메모·설정·리로드
├── styles/kei-paper.css  # KEI editorial 스타일 토큰 + 레이아웃
├── options.html/js/css   # 독립 설정 페이지 (chrome://extensions 경로)
├── fonts/                # Paperlogy 4종 + Pretendard Variable
├── lib/                  # marked.js, KaTeX + 폰트
└── icons/                # 확장 아이콘 (16/48/128 PNG + SVG 소스)
```

---

## 디자인 원칙

- **본문은 진실**: 원본 `.md` 파일은 절대 수정하지 않음. 모든 주석(형광펜·메모)은 뷰어 전용 데이터로 `chrome.storage.local` 에만 저장
- **한국어 논문 가독성**: Paperlogy / Pretendard Variable 를 번들, 본문 13pt 기준
- **조용한 editorial 톤**: KEI brief 스타일 따름 (cream + navy + 블루 강조, 박스·그라디언트·이모지 지양)
- **섹션 중심 UI**: 스크롤 위치에 따라 우측 패널이 해당 섹션의 그림·메모를 자연스럽게 보여줌

---

## 제3자 라이선스

MARKO 는 다음 오픈소스를 사용·번들합니다.

| 구성 요소 | 용도 | 라이선스 |
|---|---|---|
| [marked.js](https://github.com/markedjs/marked) | 마크다운 파서 | MIT |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 수식 렌더링 | MIT |
| [Paperlogy](https://github.com/fonts-archive/Paperlogy) | 한글 디스플레이 폰트 | SIL OFL 1.1 |
| [Pretendard](https://github.com/orioncactus/pretendard) | 한글 본문 폰트 (Variable) | SIL OFL 1.1 |

---

## 라이선스

MIT — [LICENSE](LICENSE) 참조.

---

## 제작

**김경호** · 한국환경연구원(KEI) 환경평가본부 · 2026

Claude Code 와 협업하여 개발.
