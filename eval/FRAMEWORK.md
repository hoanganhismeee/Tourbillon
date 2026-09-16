# Cách bộ đo này hoạt động

Tài liệu giải thích `eval/` — nó đo cái gì, đo bằng cách nào, và vì sao từng lựa chọn lại như vậy.
Viết cho người quay lại sau vài tháng và cần hiểu lại từ đầu.

Thuật ngữ kỹ thuật giữ nguyên tiếng Anh vì đó là cách chúng xuất hiện trong code và trong tài liệu ngành.

---

## 1. Vấn đề nó giải

Không thể nói *"search của tôi tốt"* nếu không có thước đo. Trước khi có thư mục này, mọi
phát biểu về chất lượng tìm kiếm đều là cảm tính — thử vài câu, thấy kết quả trông ổn, kết luận.

Cách đó bỏ sót mọi thứ. Khi bộ đo đầu tiên chạy, nó tìm ra `/api/search` trả về lỗi 500 cho
**mọi** query, và 8 trong 61 câu hỏi hợp lệ bị hệ thống từ chối trong im lặng. Không lỗi nào
lộ ra khi đọc code hay dùng thử.

---

## 2. Khái niệm nền

### Arm

**Một arm = một thí sinh trong cuộc so sánh.** Cùng bộ câu hỏi, cùng đáp án, cùng cách chấm.

| Arm | Gọi gì | Vai trò |
|---|---|---|
| `bm25` | `POST /api/watch/find` (`mode=bm25`) | Baseline lexical chuẩn ngành — BM25F |
| `keyword` | `GET /api/search` | Ô search của site — khớp chuỗi con với bảng điểm tự viết |
| `vector` | `POST /api/watch/find` (`mode=vector`) | Chỉ riêng vector index: không parser, không rerank, không cache |
| `hybrid` | `POST /api/watch/find` (`mode=hybrid`) | BM25F và vector, fuse bằng RRF trong backend |
| `smart` | `POST /api/watch/find` | Deterministic parser, phục vụ câu hỏi dạng facet |
| `concierge` | `POST /api/chat/message` | Chat, phụ trách câu hỏi mở |

Chênh lệch giữa `smart` và `keyword` là giá trị AI mang lại. Chênh lệch giữa `concierge` và
`smart` là chi phí riêng của tầng chat — vì cả hai gọi cùng một `WatchFinderService`.

### Scope

**Scope = nửa nào của bộ câu hỏi.** `spec` là câu hỏi dạng facet (brand, giá, kích cỡ, chất liệu,
màu mặt số, phủ định) — phần deterministic parser phụ trách. `semantic` là câu hỏi mở (dịp dùng,
gu, sự phù hợp) — phần concierge phụ trách.

Chấm một arm trên nửa nó không còn phục vụ thì con số thu được nói về **quyết định phạm vi**, không
phải về chất lượng retrieval. `--scope` sinh ra để tránh đúng nhầm lẫn đó.

### BM25 và BM25F

Công thức chấm điểm lexical chuẩn của ngành, khác ô search cũ ở ba điểm:

| | Ô search cũ (`keyword`) | BM25 |
|---|---|---|
| **IDF** — từ hiếm nặng hơn từ phổ biến | không: "watch" nặng ngang "tourbillon" | có |
| **Saturation** — lặp 10 lần không đáng gấp 10 | không | có (`k1 = 1.2`) |
| **Length normalisation** — field dài không tự thắng | không | có (`b` theo từng field) |

**BM25F** là biến thể nhiều field: tần suất ở mỗi field được nhân trọng số và chuẩn hoá độ dài,
cộng lại, rồi **mới** bão hoà một lần. Ở đây có năm field: brand (kèm alias như JLC), collection
(kèm style như sport, diver), reference, description, giá trị trong specs. Trọng số đặt theo bản
chất field, không tinh chỉnh trên bộ đo — tinh chỉnh trên chính bộ dùng để chấm là tự chấm điểm mình.

Catalogue chỉ vài trăm chiếc nên index nằm trong memory (`backend/Services/Bm25WatchIndex.cs`),
không cần Elasticsearch hay extension Postgres, và tự dựng lại mỗi 10 phút.

### RRF (reciprocal rank fusion)

Cách gộp hai bảng xếp hạng mà không cần hai điểm số cùng thang đo:

```
score(id) = tổng trên từng list của   1 / (k + vị trí trong list)
```

Chỉ dùng **vị trí**, không dùng điểm. Lý do: điểm BM25 và cosine distance không cùng đơn vị —
chuẩn hoá chúng về một thang là tự bịa ra một thang không tồn tại. Code nằm ở
`backend/Services/ReciprocalRankFusion.cs`.

`k` quyết định một vị trí số 1 đáng giá bao nhiêu so với sự đồng thuận: k nhỏ thì top 1 của một list
áp đảo, k lớn thì id nào cả hai list cùng trả về sẽ thắng. Mặc định 60 là giá trị từ bài báo gốc.

### Nhãn (label)

**Nhãn = đáp án.** Với mỗi câu hỏi, tập đồng hồ đáng lẽ phải xuất hiện.

Nhãn ở đây **không phải danh sách id**, mà là **predicate** — mô tả điều kiện để một chiếc
trở thành đáp án đúng:

```js
{ query: 'blue dial chronograph under thirty thousand',
  truth: { dialAny: ['blue'], functionsAny: ['chronograph'], priceMax: 30000 } }
```

Ba lý do:

1. **Không lỗi thời.** Thêm đồng hồ mới vào catalogue thì nhãn tự cập nhật.
2. **Cãi được.** Người khác đọc `diameterMax: 39` và nói *"39 hẹp quá"* rồi sửa. Với một
   danh sách id thì không ai làm được vậy.
3. **Không tự chấm điểm mình.** Nhãn viết từ đề bài, trước khi nhìn kết quả. Gán nhãn bằng
   cách xem hệ thống trả về gì rồi tick "cái này hợp lý" là chấm điểm chính mình.

### Hai nguồn câu hỏi

Bộ câu hỏi có 100 câu, chia đều theo hệ thống phụ trách:

| Scope | Phụ trách | n | Category |
|---|---|---|---|
| `spec` | Smart Search | 50 | reference, brand, brand alias, collection, brand + budget, budget, material, size, dial, complication, water resistance, movement, style, exclusion, compound |
| `semantic` | concierge | 50 | occasion, persona, aesthetic, lifestyle, collector, fit, budget kèm gu |

Chia theo **câu hỏi cần gì**, không theo cách diễn đạt. "Something that can time a lap" là
chronograph, "a proper strong diver" là ngưỡng water resistance — cả hai thuộc `spec`, vì dịch
chữ thường ngày sang facet là việc của lớp từ vựng trong parser. `semantic` chỉ giữ những câu
không gọi tên facet nào, nơi nhãn là phán đoán của một người bán hàng am hiểu.

`HANDWRITTEN` — 89 câu, mỗi câu có comment ghi lý do nhãn đọc brief theo cách đó, để người
review cãi được với lập luận thay vì với một danh sách id.

`buildGenerated` — câu hỏi cơ học sinh tự động từ catalogue lúc chạy: tra mã tham chiếu,
brand, brand + ngân sách, khoảng kích cỡ, chất liệu, màu mặt số, complication. Chính xác
theo cấu tạo, dùng seeded PRNG nên hai lần chạy cho ra cùng một bộ mẫu, và bị giới hạn bởi
`GENERATED_CAPS` để phần tra cứu lặp lại không lấn át câu viết tay.

---

## 3. Các chỉ số

| Chỉ số | Trả lời câu hỏi gì |
|---|---|
| **Recall@10** | Trong tập đúng, bao nhiêu % lọt vào top 10? Có bỏ sót không. |
| **Precision@5** | Trong top 5, bao nhiêu % là đúng? Có bao nhiêu rác. |
| **MRR** | Kết quả đúng **đầu tiên** nằm ở vị trí nào? |
| **nDCG@10** | Recall có trọng số theo vị trí — phân biệt "đúng nhưng bị chôn" với "đúng và ở đầu". |
| **Hit rate@10** | Người dùng có thấy được thứ gì hữu ích không? Dễ hiểu nhất với người không kỹ thuật. |
| **p50 / p95** | Người dùng chờ bao lâu. Không dùng mean — LLM tạo đuôi dài, mean che mất trải nghiệm tệ nhất. |

### Trần của recall — điều quan trọng nhất trong tài liệu này

Danh sách kết quả chứa 10 mục. Nếu nhãn khớp 76 chiếc thì recall@10 **tối đa là 10/76 = 0.13**,
dù hệ thống hoàn hảo.

Nghĩa là con số recall thô trộn lẫn hai thứ khác nhau: hệ thống xếp hạng tốt đến đâu, và
nhãn rộng đến đâu.

Trên bộ 61 câu cũ, **trần là 0.463**. Một hệ thống hoàn hảo đạt 0.463, không phải 1.000.

Nên harness in ra cả trần và tỉ lệ đạt được:

```
category        n  ceiling            smart
exclusion       2    0.152     0.152 (100%)   ← kịch trần, không phải "0.152 là kém"
dial            5    0.449     0.449 (100%)
descriptor     19    0.297     0.101  (34%)   ← yếu thật
```

Trước khi có cột này, fix xử lý phủ định trông như "0.000 → 0.152" (nghe tệ) trong khi thực
tế là **0% → 100% mức khả thi**.

### Vì sao cần khoảng tin cậy

Với 50 câu mỗi scope, một điểm số đơn lẻ là nhiễu. Lấy 50 câu khác có thể ra số khác.

**Bootstrap**: lấy mẫu lại có hoàn lại từ chính các điểm số đó, 2000 lần, mỗi lần tính trung
bình → được phân phối của trung bình → lấy phân vị 2.5% và 97.5%.

**Paired bootstrap** (dùng để so hai arm): bootstrap **hiệu số theo từng câu hỏi**, không phải
từng arm riêng. Vì hai arm chạy trên cùng bộ câu hỏi, ghép cặp khử được phương sai do câu khó
hay dễ — thứ nếu không sẽ nhấn chìm hiệu ứng cần đo.

**Luật đọc: khoảng tin cậy cắt qua 0 thì chưa phải kết quả.** Harness in thẳng chữ
`not significant` để không tự lừa mình.

---

## 4. Kiểm tra sức khoẻ nhãn

Nhãn xấu làm phép đo vô nghĩa. `--validate` loại bốn loại trước khi chấm:

| Trạng thái | Nghĩa là | Vì sao loại |
|---|---|---|
| `invalid_key` | Nhãn dùng key mà matcher không đọc | Key lạ bị bỏ qua im lặng, nhãn rộng hơn chữ viết |
| `empty` | Khớp 0 chiếc | Nhãn sai, không phải hệ thống sai |
| `too_broad` | Khớp hơn 25% catalogue | Trả bừa cũng trúng, không phân biệt được arm nào tốt hơn |
| `thin` | Dưới 2 chiếc | Recall nhảy giữa 0 và 0.5 tuỳ một kết quả duy nhất |

Ngưỡng đổi được bằng `--max-share`, để nó là tham số hiển chứ không phải hằng số ẩn.

---

## 5. Hai loại cache có thể phá phép đo

Cả hai đều đã từng làm hỏng một lần chạy trong quá trình xây dựng.

**Semantic query cache** (PostgreSQL, bảng `QueryCaches`). Lưu kết quả theo embedding của câu
hỏi. Một câu trúng cache sẽ **phát lại kết quả của lần chạy trước** — có thể sinh ra bởi code
đã thay đổi. Harness phát hiện qua prefix `cache_hit:` trong `searchPath` và in cảnh báo kèm
danh sách.

Cơ chế chống: mỗi entry mang `PipelineVersion`. Đổi logic retrieval hay đổi model thì bump
hằng số `DefaultPipelineVersion`, mọi entry version cũ lập tức vô hình. Kèm TTL 30 ngày làm
lưới đỡ cho những thay đổi không ai nhớ bump.

**Chat response cache** (Redis, key `chat:resp:*`). Lưu nguyên câu trả lời lượt đầu. Xoá trước
mỗi lần đo before/after:

```bash
docker compose exec -T redis sh -lc \
  "redis-cli --scan --pattern 'chat:resp:*' | while read k; do redis-cli del \"\$k\" > /dev/null; done"
```

`spec-questions.mjs` phát hiện qua latency: trả lời dưới 400ms là không có lần gọi model nào.

---

## 6. Các file

| File | Vai trò |
|---|---|
| `run-eval.mjs` | Runner. Chấm các arm, in bảng, ghi JSON per-query. |
| `catalogue.mjs` | Nạp catalogue từ API, chuẩn hoá specs, đánh giá predicate. |
| `queries.mjs` | Bộ câu hỏi có nhãn — handwritten + generated. |
| `metrics.mjs` | Recall, precision, MRR, nDCG, percentile, bootstrap, trần recall. |
| `metrics.test.mjs` | Test cho metrics. |
| `queries.test.mjs` | Test cấu trúc bộ câu hỏi: key hợp lệ, scope đã đăng ký. |
| `spec-questions.mjs` | Đo độ chính xác khi concierge trả lời câu hỏi về spec. |
| `grading.mjs` | Logic chấm điểm thuần cho spec-questions. |
| `grading.test.mjs` | Test cho grader. |
| `results/` | Output từng lần chạy (gitignored). |

### Vì sao grader có test riêng

Phiên bản đầu của grader báo cáo **hallucination 33%** trong khi sự thật là **0%**. Ba lỗi:
đọc khoảng số `"38–48 hours"` không ra, pattern đơn vị `h\b` khớp luôn chữ "watc**h**", và
coi mọi câu trả lời lan man là "nói sai".

Bài học: **code sinh ra con số cần test hơn code bình thường**, vì lỗi của nó tạo ra kết luận
sai một cách tự tin.

---

## 7. Cách chạy

```bash
make up                                    # backend phải chạy

node eval/run-eval.mjs --inspect           # catalogue thật có gì
node eval/run-eval.mjs --validate          # sức khoẻ nhãn, không gọi search
node eval/run-eval.mjs                     # keyword + smart
node eval/run-eval.mjs --arms=concierge    # chỉ chat
node eval/run-eval.mjs --scope=spec --arms=bm25,keyword,vector,hybrid,smart          # nhóm facet
node eval/run-eval.mjs --scope=semantic --arms=bm25,keyword,vector,hybrid,concierge   # nhóm câu hỏi mở
node eval/run-eval.mjs --from=eval/results/eval-<stamp>.json   # in lại một lần chạy, không gọi API

node eval/spec-questions.mjs --out=before   # đo trước khi sửa
node eval/spec-questions.mjs --out=after    # đo sau
node eval/spec-questions.mjs --compare=before,after

node --test eval/metrics.test.mjs eval/grading.test.mjs eval/queries.test.mjs  # test của bộ đo
cd backend.Tests && dotnet test --filter "FullyQualifiedName~Bm25|FullyQualifiedName~ReciprocalRank"  # BM25, RRF
```

Cần `WatchFinderSettings:DisableLimitInDev=true`, không thì quota chặn sau 5 câu.

### Chi phí mỗi lần chạy

Đây là tiền thật. Chỉ chạy arm bị thay đổi ảnh hưởng.

| Arm | Chi phí | Vì sao |
|---|---|---|
| `keyword` | $0 | Không gọi model |
| `bm25` | $0 | Index trong memory của backend |
| `vector` | $0 | Embedding chạy in-process trong ai-service |
| `hybrid` | $0 | BM25F + vector, fuse trong backend |
| `smart` | ~$0.05 | Chỉ ~5–16% query chạm LLM |
| `concierge` | ~$0.30 | Mọi lượt đều gọi model để viết lời |
| `spec-questions` | ~$0.12 | 24 lượt chat |

Thay đổi ở tầng deterministic (parser, filter, routing) **không** ảnh hưởng concierge — đừng
chạy arm đó.

---

## 8. Quy trình dùng nó

```
1. Đo trước       ghi lại baseline
2. Sửa một thứ    một thay đổi, không gộp
3. Test           unit test cho phần logic thuần
4. Đo lại         chỉ arm bị ảnh hưởng
5. So sánh        thay đổi có đúng như commit message nói không
6. Commit         chỉ khi bước 5 xác nhận
```

**Vì sao một thứ một lần.** Gộp ba fix rồi thấy recall +0.052 thì không biết cái nào tạo ra
nó — hay tệ hơn, một cái đang làm hỏng mà hai cái kia che đi. Con số không quy được về nguyên
nhân thì vô dụng khi bị hỏi.

Ví dụ thật: một lần thay đổi thứ tự prompt được commit với lý do "để bật prompt caching". Đo
sau đó cho thấy cache vẫn không hình thành. Vì nó là commit riêng, revert được đúng phần đó và
giữ lại phần log đã chứng minh điều đó.

---

## 9. Những cái bẫy đã gặp

Ghi lại vì chúng sẽ quay lại.

**Nhãn quá rộng.** `styleAny: ['dress']` khớp 62% catalogue — không phân biệt được gì.

**Từ vựng catalogue không nhất quán.** Dial có 112 cách viết, movement type có 23. Khớp chuỗi
con trên `"automatic"` bỏ sót 97 trong 228 chiếc automatic vì brand ghi `"Self-winding"`. Cả
hai phía đều phải chuẩn hoá về cùng một tập nhỏ.

**Chuẩn hoá xong lại mất chữ người dùng gõ.** Gom `argenté` vào nhóm Silver tìm được đủ, nhưng
xếp hạng không ưu tiên chiếc ghi đúng `argenté` — hỏi "argenté" mà nhận 15 chiếc silver không
có chiếc argenté nào. Phải khớp theo nhóm nhưng **xếp hạng theo chữ người dùng gõ**.

**Phủ định đảo ngược điều kiện.** `"not gold"` để nguyên sẽ bị matcher vật liệu đọc thành
*yêu cầu* gold. `"nothing over 20k"` bị đọc thành *sàn* 20k thay vì *trần*. Phải bóc phủ định
ra trước khi mọi matcher dương chạy.

**Ký tự vô hình trong regex.** Viết regex qua shell heredoc làm `\\b` thành ký tự backspace
(0x08) — regex không bao giờ khớp, và nhìn code không thấy gì bất thường. Dùng editor, đừng
dùng heredoc cho regex.

**Cache che kết quả.** Cả hai loại cache ở mục 5 đều đã từng làm một lần chạy trở nên vô nghĩa.

---

## 10. Giới hạn phải thừa nhận

Bộ đo này đo **"search có trả về đúng thứ khớp spec không"**. Nó **không** đo
**"người dùng có hài lòng không"**. Hai thứ khác nhau, và chỉ A/B test với người thật mới đo
được cái thứ hai.

n = 50 mỗi scope. Đủ để phát hiện hiệu ứng lớn, không đủ cho hiệu ứng nhỏ. Đó là lý do mọi
delta đều kèm khoảng tin cậy.

Relevance mang tính chủ quan, và điều đó không giải được. Cách hạn chế: nửa `spec` có đáp án
khách quan vì quy về facet; nửa `semantic` chủ quan, được tách riêng và báo điểm riêng; và vì
cả hai arm chấm bằng cùng bộ nhãn, thiên lệch trong định nghĩa triệt tiêu ở phép trừ — nên
con số đáng quote là **delta**, không phải giá trị tuyệt đối.
