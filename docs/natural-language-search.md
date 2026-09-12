# Natural Language Search — học từ đầu

Tài liệu này giải thích Smart Search hoạt động ra sao, bằng cách **đi theo từng câu hỏi thật**
từ lúc user gõ tới lúc kết quả hiện ra.

Thuật ngữ giữ tiếng Anh vì đó là dạng bạn gặp trong code và khi phỏng vấn.

---

## Phần 1 — Bài toán

Catalogue có 338 chiếc đồng hồ. Vấn đề: **người mua không biết từ vựng của catalogue.**

```
user gõ                        catalogue lưu
"mặt số xanh đậm"              dial.color = "Blue"
"đeo đi làm được"              collection.styles = ["dress"]
"khoảng năm mươi nghìn"        currentPrice = 48500
"không phải vàng"              case.material = "Stainless steel"
```

Keyword search chỉ hoạt động khi user **đã biết** phải gõ gì. Gõ "Rolex" thì tìm được Rolex.
Gõ "đồng hồ đi đám cưới" thì không có chữ nào khớp.

---

## Phần 2 — Ý tưởng cốt lõi: không phải câu nào cũng cần AI

Đây là quyết định kiến trúc quan trọng nhất, nên hiểu kỹ.

Nhiều người dựng search bằng AI theo kiểu: mọi câu hỏi → LLM → kết quả. Đơn giản, nhưng chậm
và đắt cho **mọi** câu, kể cả câu dễ nhất.

Tourbillon chia làm ba tier. Câu hỏi đi từ trên xuống, tier nào trả lời được thì dừng.

```
tier 1   deterministic SQL     83% câu    p50  27ms    0 lần gọi AI
tier 2   LLM parse → SQL       10% câu    p50 2.7s     1 lần gọi AI
tier 3   vector + LLM rerank    7% câu    p50 5.1s     2 lần gọi AI + 1 embed
```

Kết quả: **$0.53 cho 1.000 lượt tìm kiếm.** Nếu mọi câu đều đi tier 3 thì là $4.80 — đắt gấp 9 lần.

---

## Phần 3 — Đi theo ba câu hỏi thật

### Ví dụ A: `"gold watch under 50k"` → tier 1, 29ms

**Bước 1.** Parser đọc câu bằng regex, rút ra ràng buộc:

```csharp
// WatchFinderService.ApplyRegexFilters
"gold"       → materialMap khớp \b(?:rose|white|yellow|pink|red)?\s*gold\b
             → intent.CaseMaterial = "Gold"

"under 50k"  → priceMap khớp (?:under|below|less than)\s*\$?\s*(\d[\d,]*)\s*(k?)\b
             → intent.MaxPrice = 50000
```

**Bước 2.** Có đủ ràng buộc → chạy SQL:

```sql
WHERE "CurrentPrice" <= 50000
  AND specs->'case'->>'material' ILIKE '%gold%'
```

**Bước 3.** Trả 15 kết quả. **Không gọi AI lần nào.**

---

### Ví dụ B: `"my budget is around fifty thousand dollars"` → tier 2, 2.7s

**Bước 1.** Regex tìm chữ số — `(\d[\d,]*)` không khớp gì, vì "fifty thousand" là chữ.

Thực ra parser có bước chuyển số viết bằng chữ (t thêm hôm nay), nên câu này giờ đi tier 1.
Nhưng lấy nó làm ví dụ cho cơ chế tier 2, vì trước khi có bước đó nó rơi xuống đây.

**Bước 2.** Không rút được gì → gọi LLM đọc câu:

```
POST /watch-finder/parse
→ { "minPrice": 35000, "maxPrice": 65000 }
```

**Bước 3.** SQL **chạy lại** với intent vừa nhận. LLM không chọn đồng hồ nào — nó chỉ dịch câu
sang cấu trúc, rồi trả quyền quyết định cho SQL.

Tier này thắng đậm nhất trong đo đạc: **recall 0.197 so với keyword 0.032** trên cùng những câu.
LLM làm đúng việc nó giỏi — hiểu ngôn ngữ — và không làm việc nó dở.

---

### Ví dụ C: `"a bold statement piece with real wrist presence"` → tier 3, 4.4s

Không có brand, không có giá, không có chất liệu, không có size. Regex bó tay, LLM parse cũng
không rút ra được ràng buộc SQL nào — vì "statement piece" không phải một cột.

**Bước 1. Embed câu hỏi.**

```
POST /embed  { "texts": ["a bold statement piece..."] }
→ [0.021, -0.118, 0.334, ... ]   768 số
```

**Bước 2. pgvector tìm vector gần nhất.**

```sql
SELECT * FROM "WatchEmbeddings"
ORDER BY "Embedding" <=> '[0.021,-0.118,...]'::vector
LIMIT 15
```

`<=>` là toán tử cosine distance của pgvector.

**Bước 3. LLM rerank** — đưa 15 ứng viên cho Haiku chấm điểm lại.

**Bước 4.** Trả 15 card đã xếp hạng.

---

## Phần 4 — Embedding là gì

Đây là khái niệm khó nhất, nên giải thích riêng.

**Embedding là biến văn bản thành một dãy số, sao cho văn bản gần nghĩa thì số gần nhau.**

```
"blue dial"      → [0.021, -0.118, 0.334, ...]
"navy face"      → [0.019, -0.121, 0.330, ...]   gần → cùng ý
"leather strap"  → [0.412,  0.087, -0.201, ...]  xa  → khác ý
```

Đo "gần nhau" bằng **cosine similarity** — góc giữa hai vector:

```
1.00   giống hệt
0.95   gần như cùng nghĩa
0.75   liên quan
0.30   không liên quan
```

Số thật đo trên hệ của bạn:

```
"blue dial"  vs  "black dial"          0.741
"silver dial" vs "silver-toned dial"   0.937
```

### Embedding model KHÔNG phải LLM

Hai loại model hoàn toàn khác nhau:

```
                 Haiku (LLM)              all-mpnet (embedding)
input            văn bản                  văn bản
output           VĂN BẢN                  768 CON SỐ
việc             viết, quyết định         đo độ giống nhau
kích thước       rất lớn, độc quyền       420 MB
```

LLM không sinh ra vector. Embedding model không viết được câu.

**Anthropic chỉ bán LLM, không có endpoint embeddings.** Đó là lý do phải chạy một model riêng.

### Mỗi model là một hệ toạ độ riêng

Ví von: hai người cùng chấm 100 bộ phim theo 768 tiêu chí, nhưng chưa bao giờ thống nhất tiêu
chí là gì.

```
người A   tiêu chí #1 = "hài đến mức nào"
người B   tiêu chí #1 = "dài bao nhiêu phút"
```

Đem hai bảng số ra so thì vô nghĩa. Vector từ hai model cũng vậy.

**Quy tắc bất di bất dịch:** model embed document phải là chính model embed query.

```
index: mpnet → search: mpnet    ✅
index: nomic → search: mpnet    ❌ rác, và KHÔNG BÁO LỖI
```

Vì thế `WatchEmbedding` có cột `EmbeddingModel` ghi lại model nào tạo ra vector đó. Khởi động
lên, backend so với hằng số hiện tại; khác thì xoá và sinh lại.

### Số chiều là thuộc tính của model

```
all-MiniLM-L6-v2                384
all-mpnet-base-v2               768
nomic-embed-text-v1.5           768
OpenAI text-embedding-3-small  1536
```

Cột trong DB là cố định `vector(768)`. Nên đổi sang model 1536 chiều là phải viết migration.
Đó là lý do chọn `all-mpnet-base-v2` — 768 = 768, cột giữ nguyên.

---

## Phần 5 — Semantic cache

Câu hỏi giống nghĩa trả cùng kết quả, nên lưu lại.

Khoá cache **không phải chuỗi văn bản** mà là **vector**. Nên câu diễn đạt khác vẫn trúng:

```
đã lưu:  "wedding day watch gold"
hỏi mới: "a gold watch for a wedding"
         cosine 0.95 > threshold 0.92  →  trúng
```

```
cache hit        ~430ms
tính lại đầy đủ  ~3,390ms       nhanh hơn ~8 lần
```

Cache **chỉ phục vụ tier 3**. Tier 1 chạy 27ms — cache lookup còn chậm hơn, vì phải embed câu
hỏi trước rồi mới tra được.

### Vì sao cache buộc phải có version

Đây là chỗ dễ sai nhất, và nó **đã sai hai lần** trong quá trình làm.

Sửa logic search → cache vẫn trả **kết quả do code cũ tạo ra**. Không lỗi, không cảnh báo.
Hai lần một phép đo bị hỏng vì lý do này mà không ai nhận ra.

Cách chống: mỗi entry mang `PipelineVersion`.

```csharp
private const string DefaultPipelineVersion = "v5-mpnet768-haiku";
```

Lookup lọc theo version. Đổi logic thì bump hằng số → mọi entry cũ lập tức vô hình.

```
v1  nomic + qwen
v2  đổi sang Haiku
v3  thêm dial colour thành filter
v4  sửa movement family, bounds
v5  đổi embedding sang mpnet
```

Kèm TTL 30 ngày, và một job dọn lúc khởi động — có lần bảng chứa 226 dòng chết so với 21 dòng
sống, vì bump version làm entry vô hình nhưng không xoá nó đi.

---

## Phần 6 — Đo chất lượng

Không thể nói "search của tôi tốt" nếu không có thước đo. Chi tiết ở `eval/FRAMEWORK.md`,
đây là phần tóm tắt.

61 câu hỏi có **label** — label nghĩa là **đáp án**.

```
query:  "blue dial chronograph under thirty thousand"
label:  { dialAny: ['blue'], functionsAny: ['chronograph'], priceMax: 30000 }
```

Label không phải danh sách id mà là **điều kiện**. Máy quét cả 338 chiếc và tự dựng ra tập
đáp án. Thêm đồng hồ mới thì label tự cập nhật.

### Kết quả

```
arm          recall   prec@5    MRR    nDCG    hit     p50
keyword       0.269   0.459   0.605   0.542  0.869    66ms
smart         0.370   0.708   0.845   0.771  0.951    30ms

recall     +0.101   95% CI [0.060, 0.145]   có ý nghĩa
precision  +0.249   95% CI [0.144, 0.354]   có ý nghĩa
```

### `@10` nghĩa là gì

`recall@10` = trong tập đáp án, bao nhiêu % lọt vào **top 10**.

Phải cắt, vì nếu không thì một hệ thống trả về **cả 338 chiếc** sẽ đạt điểm tuyệt đối. `@k`
buộc hệ thống phải **xếp hạng**, không chỉ lọc.

### Trần của recall

Danh sách chứa được 10 mục. Nếu label khớp 76 chiếc thì:

```
recall@10 tối đa = 10/76 = 0.13
```

Trên bộ query này trần là **0.463** — một hệ thống hoàn hảo cũng chỉ đạt thế. Nên `0.370` thực
ra là **80% mức khả thi**, không phải 37%.

```
category        n   trần    smart      đạt
brand           6  0.441   0.441     100%   kịch trần
brand_budget    4  0.728   0.728     100%   kịch trần
dial            5  0.449   0.449     100%   kịch trần
exclusion       2  0.152   0.152     100%   kịch trần
reference       6  1.000   1.000     100%   kịch trần
descriptor     19  0.297   0.129      43%   yếu nhất
size            2  0.270   0.070      26%   n=2, không quote được
```

---

## Phần 7 — Tier 3 có đáng giá không

Câu hỏi khó chịu nhất, và số liệu trả lời không dễ chịu.

Chấm keyword **trên đúng những câu mỗi tier phục vụ**:

```
tier                       n    smart   keyword    delta      p50
deterministic SQL         51    0.412    0.309    +0.102      27ms
LLM parse → SQL            6    0.197    0.032    +0.165   2,660ms
vector + LLM rerank        4    0.095    0.105    −0.010   5,125ms
```

**Tier 3 không hơn được keyword search trên chính những câu nó phục vụ, và chậm hơn 190 lần.**

Cảnh báo: n=4, quá nhỏ để chốt. Nhưng hướng nhất quán qua nhiều lần chạy và nhiều model —
kể cả sau khi đổi embedding từ nomic sang mpnet, tier 3 vẫn không tách khỏi keyword.

Hệ quả thực tế: **mỗi lần đẩy được một loại câu từ tier 3 xuống tier 1 là vừa nhanh hơn vừa
đúng hơn.** Đó là việc đã làm với dial colour, negation, số viết bằng chữ.

---

## Phần 8 — Chín cái bẫy đã gặp

Ghi lại vì chúng sẽ quay lại dưới dạng khác.

**1. Từ vựng catalogue không nhất quán.** Dial có 112 cách viết, movement type có 23.

```
"automatic"  khớp chuỗi con  → bỏ sót 97 trong 228 chiếc automatic
                               vì brand ghi "Self-winding"
```

Cả hai phía phải normalise về cùng một tập nhỏ.

**2. Normalise xong lại mất chữ user gõ.**

```
"argenté dial" → gom vào nhóm Silver → trả 15 chiếc silver
               → KHÔNG chiếc nào ghi "argenté"  →  recall 0, precision 0
```

Phải **khớp theo nhóm, xếp hạng theo chữ user gõ**.

**3. Negation đảo ngược điều kiện.**

```
"not gold"          → matcher vật liệu đọc thành YÊU CẦU gold
"nothing over 20k"  → đọc thành SÀN 20k thay vì TRẦN
```

Phải bóc negation ra **trước** khi mọi matcher dương chạy.

**4. Regex backtrack qua chính guard của nó.**

```
pattern:  (\d[\d,]*)\s*(k?)(?!\s*mm)
input:    "under 40mm"
          guard chặn "40" → backtrack lấy "4" → heuristic → ngân sách $4,000
          → 0 kết quả
```

Sửa bằng `\b` sau `(k?)` để chặn backtrack.

**5. Va chạm giữa từ tiền và tên riêng.**

```
"twenty grand"  →  "grand" bị nhận là collection Grand Complications
                →  query thành "collection đó AND giá ≤ 20.000"
                →  0 kết quả, mà log vẫn báo intent parse ĐÚNG
```

**6. searchPath nói dối.** Khi embedding hỏng, pipeline nạp candidate từ SQL nhưng vẫn gán nhãn
`vector_llm_rerank`. Tín hiệu duy nhất phát hiện được embedding tắt lại báo ngược.

**7. Cache che kết quả đo.** Hai lần một phép đo bị hỏng vì cache trả kết quả của code cũ.

**8. Dependency nâng major âm thầm.** `anthropic>=0.18.0` không có trần → cài thư viện khác kéo
lên 1.4.0 → `temperature` bị bỏ → mọi lời gọi LLM ném `TypeError` → handler biến thành
`confidence 0.0` → routing đọc thành "classifier chết" → từ chối 6 query hợp lệ. Bảng eval hiện
ra **như một lỗi retrieval**.

**9. Embedding tắt trên production suốt nhiều tháng.** `EMBED_BASE_URL` không được set, Anthropic
không có endpoint embeddings → `/embed` trả 503 → vector search và cache chết, **trong im lặng**.

---

## Phần 9 — Điểm vào code

| Việc | File |
|---|---|
| Orchestration, chọn tier | `backend/Services/WatchFinderService.cs` |
| Tier 1, SQL | `backend/Services/DeterministicWatchSearchService.cs` |
| Đọc câu bằng regex | `WatchFinderService.ApplyRegexFilters` |
| Normalise dùng chung với chat | `backend/Services/QueryNormalizer.cs` |
| Semantic cache | `backend/Services/QueryCacheService.cs` |
| Sinh vector cho watch | `backend/Services/WatchEmbeddingService.cs` |
| embed / parse / rerank | `ai-service/routes/embeddings.py`, `routes/watch_finder.py` |
| Bộ đo | `eval/` — xem `eval/FRAMEWORK.md` |
