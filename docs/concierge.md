# Concierge — học từ đầu

Tài liệu này giải thích chat concierge bằng cách **đi theo một cuộc hội thoại thật**, từng lượt
một, xem backend làm gì ở mỗi bước.

Đọc `natural-language-search.md` trước sẽ dễ hơn — concierge dùng lại chính engine tìm kiếm đó.

---

## Phần 1 — Concierge khác Smart Search chỗ nào

Smart Search nhận một câu, trả một danh sách. Concierge phải làm ba việc cùng lúc:

```
1. lấy đúng watch card       ← dùng chung engine với Smart Search
2. viết lời                  ← LLM
3. gợi ý hành động tiếp       ← so sánh, xem thêm, điều hướng
```

Và nó có **context**: lượt thứ ba phụ thuộc hai lượt trước.

```
lượt 1   "Show me Rolex divers"
lượt 2   "cái thứ hai nhỏ hơn không"        ← "cái thứ hai" là gì?
lượt 3   "so sánh nó với Omega"             ← "nó" là gì?
```

Smart Search không bao giờ phải trả lời những câu đó.

---

## Phần 2 — Nguyên tắc cốt lõi: backend quyết định, LLM chỉ viết lời

Đây là lựa chọn kiến trúc quan trọng nhất, và nó **đi ngược cách nhiều người dựng chatbot**.

```
backend .NET     quyết định TẤT CẢ
                 intent nào, tìm gì, trả card nào, phát action gì

ai-service       chỉ viết văn bản
                 system prompt CẤM nó tự phát sinh action
```

Cách thông thường (LangChain, agent framework) là ngược lại: đưa tool cho LLM, để nó tự quyết
định gọi cái nào. Tourbillon không làm thế.

### Vì sao

Catalogue là nguồn sự thật, và nó nằm ở backend. Để LLM tự chọn sản phẩm là mở cửa cho nó **bịa
ra đồng hồ không tồn tại**.

Cách này thì điều đó **không thể xảy ra về mặt cấu trúc** — card đến từ SQL, không đến từ model.
Model nhận một danh sách đã chốt và viết lời quanh chúng.

Đo được: 24 câu hỏi về spec, **0 câu hallucination**. Model thà im còn hơn đoán.

---

## Phần 3 — Đi theo một cuộc hội thoại

### Lượt 1: `"Show me Rolex divers"`

```
rate limit          Redis, kiểm tra quota theo IP hoặc user
abuse check         regex — cấu trúc, không ngữ nghĩa
cursor command      "chiếc thứ hai"? không phải
entity resolution   "Rolex" → brandId 7
classify            POST /classify → { intent: "discovery", confidence: 1.0 }
dispatch            discovery → WatchFinderService
                    có brandId rồi → tier 1, SQL, 20ms
backend dựng        6 watch card + action "compare"
song song:
  POST /chat          → viết lời quanh 6 card đó
  POST /plan-actions  → gợi ý chip: "xem thêm", "so sánh"
```

Lưu vào Redis:

```
chat:session:{id}  →  lastWatchCards = [6 card vừa trả]
                      followUpMode = "watch_cards"
```

### Lượt 2: `"cái thứ hai nhỏ hơn không"`

```
cursor command      KHỚP — "thứ hai" là lệnh cấu trúc
                    → đọc lastWatchCards[1] từ Redis
                    → không cần gọi AI để hiểu "thứ hai" là gì
classify            intent: contextual_followup
dispatch            lấy watch đó, so đường kính
```

**Điểm đáng chú ý:** hiểu "cái thứ hai" là việc **cấu trúc**, không phải ngữ nghĩa. Nó được xử
lý bằng regex **trước** classifier, vì nó tất định — không cần model để đếm.

### Lượt 3: `"vỏ của nó làm bằng gì"`

Đây là lượt từng hỏng, và cách sửa đáng học.

**Trước khi sửa:**

```
resolve exact watch  → tìm ra chiếc đang nói tới
BuildExactWatchResolution → trả về CÂU VIẾT SẴN:

  "...is the closest exact match in Tourbillon's catalogue.
   It sits in Marine from Breguet and is listed at Price on Request."
```

Hỏi vỏ làm bằng gì → nhận được collection và giá. **Model không bao giờ được gọi**, vì
`UseAi` mặc định `false` và handler đó không bật nó.

Hỏi power reserve, hỏi có hợp đi làm không — **cùng một câu trả lời**.

**Cách sửa — một phép thử cấu trúc:**

```
bỏ đi các từ thuộc tên watch / brand / collection
bỏ đi từ đệm (the, a, show, me, watch, find...)
còn lại ≥ 2 từ có nghĩa  →  đây là CÂU HỎI → gọi model kèm specs
còn lại 0-1 từ           →  đây là TRA CỨU → giữ câu viết sẵn, nhanh và miễn phí
```

Ví dụ:

```
"5527TI/G2/TW0"                              → 0 từ còn lại  → tra cứu
"show me the Breguet Marine 5527TI/G2/TW0"   → 0 từ còn lại  → tra cứu
"what is the case of the 5527 made of?"      → "case", "made" → câu hỏi
```

**Kết quả đo được:** accuracy trả lời câu hỏi spec **0.250 → 0.583**, hallucination vẫn **0**.

---

## Phần 4 — 14 intent

```
discovery              tìm kiếm thông thường
advice_request         tư vấn hợp/không hợp
watch_compare          so sánh hai chiếc
collection_compare     so sánh hai bộ sưu tập
brand_decision         "Vacheron hay Lange?"
brand_info             giới thiệu thương hiệu
brand_history          lịch sử thương hiệu
collection_info        giới thiệu bộ sưu tập
affirmative_followup   "ừ", "được"
expansion_request      "cho xem thêm"
revision_request       "rẻ hơn chút"
contextual_followup    câu tiếp phụ thuộc lượt trước
non_watch              ngoài chủ đề
unclear                không rõ
```

Ranh giới khó nhất là `discovery` và `advice_request`:

```
"blue dial chrono under 30k"            → discovery
                                          brief về spec, trả danh sách

"do I suit a diving watch, female 26"   → advice_request
                                          hợp hay không hợp, cần lời khuyên trước
```

`advice_request` giới hạn card xuống 3 và bật `mode: "advisor"` — prompt dẫn bằng lời khuyên
cá nhân trước, rồi mới tới danh sách gọn.

---

## Phần 5 — Bốn quy tắc routing

Cả bốn đều rút ra từ lần đã sai.

### 1. Ngữ nghĩa dùng model, cấu trúc dùng regex

Cổng `non_watch` từng là một **allowlist từ vựng** — câu không chứa từ nào trong danh sách thì
bị gạt. Nó loại 8 trong 61 câu hỏi hợp lệ:

```
"something understated I can wear to the office"   ← không có "watch"
"something that can time a lap"                    ← không có "chronograph"
"a deep blue face"                                 ← có "face", không có "dial"
```

Regex là **allowlist** — nó không bao giờ liệt kê hết được cách người ta diễn đạt.

Sửa: regex không thấy gì thì **hỏi classifier**, và chỉ từ chối khi classifier nói `non_watch`
với confidence đủ cao. Từ chối cần **bằng chứng dương** là ngoài chủ đề, không phải **thiếu
bằng chứng** là trong chủ đề.

### 2. Có entity rồi thì dùng SQL

Biết `brandId` rồi thì `GetCatalogueSampleAsync` là đủ. Để dành vector + rerank cho câu mà bộ
lọc DB không diễn đạt nổi.

### 3. `return null` phải kèm lời giải thích

Handler không làm được việc (ví dụ compare mà chỉ có 1 watch) thì phải trả câu giải thích.
`return null` im lặng sẽ trôi xuống handler không liên quan và cho ra output khó hiểu.

### 4. Nêu tên một chiếc không phải là hỏi về nó

Xem lượt 3 ở Phần 3.

---

## Phần 6 — Context và bộ nhớ

```
chat:session:{id}      Redis hash — trạng thái phiên
lastWatchCards         card lượt trước, để "so sánh hai cái đầu" hiểu được
sessionHistory         10 tin gần nhất, cửa sổ trượt
```

Cửa sổ trượt 10 tin có một hệ quả không rõ ràng: khi đầy, tin cũ nhất bị đẩy ra, nên **phần đầu
prompt đổi mỗi lượt**. Đó là một trong hai lý do prompt caching không dùng được — xem Phần 8.

---

## Phần 7 — Chi phí: vì sao chat đắt hơn search 8 lần

```
Smart Search    $0.53 / 1.000 lượt
Concierge       $4.48 / 1.000 lượt
```

Lý do rất rõ:

```
Smart Search    gọi model cho  ~16% câu hỏi
Concierge       gọi model cho   100% lượt
```

Chat **phải viết câu trả lời**. Kể cả khi câu hỏi là `"Rolex watches"` mà SQL trả lời trong 17ms,
chat vẫn phải gọi model để viết lời. Không tránh được — đó là bản chất của giao diện chat.

```
smart       p50     20ms
concierge   p50  6,700ms      chậm hơn 335 lần
```

### Cắt token: 7.335 → 3.774 mỗi lượt

Context gửi cho model từng chứa **nguyên cục JSON specs** và **toàn bộ mô tả editorial** cho mỗi
card:

```
Specs JSON       758 ký tự / chiếc
Description      368 ký tự / chiếc
× 10 card      = ~2.800 token mỗi lượt
```

Để model viết ra... 200 token văn xuôi.

Giữ field người mua thật sự hỏi, bỏ field chưa bao giờ xuất hiện trong câu trả lời:

```
GIỮ   vật liệu, đường kính, chống nước, màu mặt số,
      bộ máy, power reserve, chức năng, dây

BỎ    tên caliber, tần số dao động (28.800 vph), số chân kính,
      loại kính, loại nắp lưng, loại khoá, kiểu kim, kiểu vạch số
```

```
token vào/lượt   7,335 → 3,774     −49%
$/1.000 lượt     $8.34 → $4.48     −46%
accuracy spec    0.583 → 0.625     TĂNG
```

Bớt nhiễu thì model trả lời đúng **nhiều hơn**. Đó cũng là lý do không cắt sâu hơn — cắt tiếp
sẽ chạm vào field mà đo đạc cho thấy model đang dùng.

---

## Phần 8 — Prompt caching không dùng được ở đây

Đã thử và thất bại. Ghi lại để không thử lại.

Cache của Anthropic yêu cầu **phần đầu giống nhau** đạt tối thiểu:

```
Haiku 4.5 cần        ≥ 4.096 token
CHAT_SYSTEM_PROMPT    ~ 1.821 token
```

Không đủ. Và lý do thứ hai: `sessionHistory.TakeLast(10)` là **cửa sổ trượt**, nên prefix đổi
mỗi lượt — không bao giờ ổn định.

Cách phát hiện quan trọng:

```
cache_read = 0   và   cache_write = 0
```

`cache_write = 0` nói cache **chưa bao giờ được tạo ra** — khác hẳn "tạo rồi mà không đọc được".
Nếu chỉ log `cache_read` thì hai trường hợp đó nhìn giống hệt nhau, và bạn sẽ đi sửa nhầm chỗ.

---

## Phần 9 — Concierge làm mất bao nhiêu chất lượng

Cả hai dùng chung engine, nên chấm bằng cùng 61 query sẽ tách được **chi phí riêng của tầng chat**.

```
arm          recall   prec@5    MRR    hit      p50
smart         0.321   0.557   0.675  0.803     18ms
concierge     0.265   0.495   0.661  0.770  6,733ms
```

Hai dòng này lấy từ **cùng một lần chạy** (`eval-2026-09-09T15-44-01`), và đó là điều kiện bắt
buộc để so được — ghép số smart của lần chạy này với số concierge của lần chạy khác là so hai
hệ thống ở hai thời điểm khác nhau. Smart Search từ đó đã lên `0.370`; arm concierge chưa chạy
lại, nên **tỉ lệ** dưới đây vẫn đúng còn **giá trị tuyệt đối** thì đã cũ.

Recall thấp hơn — **nhưng** phải nhìn số card trả về:

```
smart       trung bình 11.2 kết quả
concierge   trung bình  7.6 kết quả
```

Chat cố ý hiện ít card hơn, nên recall bị thiệt. So bằng **MRR** thì công bằng hơn, vì MRR chỉ
nhìn kết quả đúng **đầu tiên** nằm ở đâu:

```
smart       MRR 0.675
concierge   MRR 0.661
```

Gần như bằng nhau. **Tầng chat gần như không làm mất chất lượng xếp hạng.** Nó chỉ đưa ra ít
lựa chọn hơn, và chậm hơn nhiều.

---

## Phần 10 — Đo cái mà bộ đo retrieval không thấy

Bộ đo retrieval chấm *card nào được trả về*. Nó **không thấy** *lời viết ra có đúng không*.

`eval/spec-questions.mjs` hỏi 24 câu về spec của một chiếc cụ thể rồi đối chiếu database:

```
"What is the power reserve of the 5304/301R-001?"
DB nói:  38 hours
```

Mỗi câu trả lời rơi vào một trong bốn nhóm:

```
correct      nêu đúng giá trị
absent       không nêu giá trị — thất bại AN TOÀN
wrong        nêu MỘT GIÁ TRỊ KHÁC — hallucination, đây là thứ đáng sợ
off-target   trả lời về chiếc khác — lỗi tìm kiếm, không phải lỗi lời
```

### Vì sao phân biệt `absent` với `wrong` là toàn bộ ý nghĩa

Bản grader đầu tiên gộp chúng lại và báo cáo **hallucination 33%**.

Đọc kỹ câu trả lời thật thì thấy sai. Ví dụ một câu bị gắn nhãn "bịa":

```
hỏi:  "vỏ của Breguet 5527 làm bằng gì?"
đáp:  "...is the closest exact match in Tourbillon's catalogue.
       It sits in Marine from Breguet and is listed at Price on Request."
```

Nó **không nói sai vật liệu**. Nó không nói gì về vật liệu cả. Đó là **không trả lời**, hoàn
toàn khác với **nói sai**.

Sau khi sửa grader: **wrong = 0**.

**Bài học: code sinh ra con số cần test hơn code bình thường**, vì lỗi của nó tạo ra kết luận
sai một cách tự tin.

---

## Phần 11 — Vì sao không dùng LangChain

Câu hỏi hay gặp, nên trả lời sẵn.

Orchestration của concierge nằm ở **C#**. LangChain là Python/JS. Dùng nó nghĩa là chuyển toàn
bộ logic điều hướng sang Python — không phải thêm thư viện, mà là đổi chỗ trung tâm hệ thống.

Và LangChain mang lại gì:

```
conversation memory      đã có — Redis session
agent loop / tool call    CỐ Ý không muốn — backend quyết định, không phải LLM
chains                    flow cố định, không phải chain động
output parser             đã có — parse_llm_json
```

Thứ chính nó mang lại là **để LLM tự quyết định gọi tool nào** — đúng cái kiến trúc này cấm, và
việc cấm đó **đo được là đúng**: 0 hallucination trên 24 câu hỏi spec.

Dùng LangChain không sai. Nó chỉ được thiết kế cho bài toán ngược lại.

Cách mô tả đúng khi phỏng vấn: *"trợ lý phát sinh action trên catalogue có cấu trúc, backend là
nơi quyết định duy nhất"* — không phải "em dùng RAG với LangChain".

---

## Phần 12 — Điểm vào code

| Việc | File |
|---|---|
| Orchestration chat | `backend/Services/ChatService.cs` |
| Gọi classifier | `backend/Services/ChatIntentClassifier.cs` |
| Action planner | `backend/Services/ActionPlannerService.cs` |
| Prompt phân loại | `ai-service/routes/classify.py`, `prompts/classify.py` |
| Prompt chat | `ai-service/prompts/chat.py` |
| Action planner | `ai-service/routes/plan_actions.py` |
| Giao diện | `frontend/app/components/chat/ChatWidget.tsx`, `ChatPanel.tsx` |
| Kiểm tra đa lượt | `test-chat-context-resilience.mjs` |
| Đo accuracy spec | `eval/spec-questions.mjs` |
