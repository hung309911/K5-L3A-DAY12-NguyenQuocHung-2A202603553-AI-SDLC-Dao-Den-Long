# Phase 1 — spec, giả định, quyết định và đánh giá

## Đầu vào và lựa chọn kiến trúc

Đã nhận hai bản dán từ người dùng ngày 21/11/2026; cả hai là PRD-0 + Test Contract v1.0, không phải ticket của phase sau. Nội dung gốc lưu ở `docs/requirements/`. Chọn JavaScript ES modules + Three.js: bản web phục vụ máy Windows/macOS/Linux; Node.js chạy mô phỏng mà không tải renderer, DOM hoặc GPU. Web và CLI dùng cùng `Game` và cùng `game.contract.json`.

## Tiêu chí nghiệm thu

| Yêu cầu | Bằng chứng tái lập | Kết quả local |
| --- | --- | --- |
| Đảo tròn, 5 đèn, Mây có nón lá và đèn nhỏ, góc nhìn 3D | `desktop-intro.png`, `desktop-playing.png` | Đạt |
| Di chuyển theo camera, chuẩn hóa đường chéo | Unit test chuyển động, browser keyboard QA | Đạt |
| Nhảy, giữ nút không nhảy liên tục | Unit test jump, browser QA | Đạt |
| Nhặt đom đóm, giới hạn túi | Test pickup/radius/capacity và `win.jsonl` | Đạt |
| Nạp từng phần, thắp đủ 5 đèn | Test deposit/edge, `win.jsonl` | Đạt |
| Bóng Mực đuổi và gây mất máu, có bất tử | Test chase/contact/invuln, `no-flames.jsonl` | Đạt |
| Tỏa sáng tốn ánh sáng, stun/đẩy/hồi chiêu | Test pulse và `pulse.jsonl`, ảnh `desktop-pulse.png` | Đạt |
| Đèn sáng tạo vùng an toàn, đảo sáng dần | Test safe zone, ảnh `desktop-won.png` | Đạt |
| Thắng/thua/điểm/HUD/chơi lại | Test terminal state, browser QA won/lost/replay | Đạt |
| Đếm tick và snapshot theo contract | CLI test tick 0, event k+1, interval/end | Đạt |
| Đầu vào hỏng trả 2, stderr | CLI test malformed JSON/schema/args | Đạt |
| Tất định kể cả ID | `npm run verify`: chạy lại và so từng byte | Đạt |
| Màn mặc định thật chơi thắng được | `default-playthrough.jsonl`, không có scenario override | Đạt; bot seed 12 thắng tick 2925 |
| Bản web phục vụ cross-platform | Build không CDN; kiểm tra Chrome local Windows, CI Ubuntu/macOS | Local đạt; CI chỉ được ghi đạt sau khi GitHub chạy thật |

Đường dẫn ảnh/output trong bảng tính từ `docs/proof/phase-1/`. Scenario thắng được sắp đặt để kiểm tra từng cơ chế; replay màn mặc định là kiểm tra riêng, không sửa trạng thái game.

## Giả định tự chọn theo phần mơ hồ của PRD

- Đảo bán kính 32 m, đèn nằm trên vòng tròn bán kính 19 m. Có rào vô hình tại bờ (vòng sáng chỉ vị trí), không có phạt rơi; `fall_enabled=false`.
- Mỗi đèn cần 10 đom đóm; túi tối đa 12. Nhấn E một lần nạp nhiều nhất có thể vào đèn chưa sáng gần nhất trong 2,5 m; nếu bằng khoảng cách ưu tiên ID nhỏ hơn. Giữ E không tự nạp tiếp.
- Nhặt tự động trong 1,35 m theo XZ, kể cả khi nhảy. Không loại bỏ đom đóm nếu túi đầy.
- F tiêu 3 đom đóm, tác động XZ trong 5 m, stun 3 s, đẩy 3 m, hồi 1,2 s. Nhấn thiếu ánh sáng hoặc khi chưa hồi không tiêu phí. Đối tượng trùng vị trí bị đẩy theo +X.
- Bóng Mực di chuyển 2,2 m/s, tầm chạm 0,85 m. Một lần trúng trừ một sức sống; bất tử 2 s. Rơi `floor(carried * 0.25)` đom đóm, tạo lại chúng cách người chơi 1,8 m để có thể nhặt lại.
- Đèn chỉ tạo vùng an toàn sau khi sáng; bán kính 4 m bao gồm biên. Bóng Mực không đi vào vùng đó. Nếu scenario đặt sẵn Bóng Mực bên trong, nó tìm cách đi ra và không gây sát thương ở đó.
- Ban đầu 90 đom đóm, 3 Bóng Mực. Nếu cho phép random, bù một đom đóm mỗi 2 s khi dưới 90; thêm Bóng Mực mỗi 18 s đến tối đa 8. Khai báo này nằm ở `world` trong contract. Cờ random=false tắt cả khởi tạo ngẫu nhiên và sinh thêm.
- Nhảy vận tốc đầu 8 m/s, trọng lực 22 m/s²; hạ cánh tại Y=0. Các quy tắc nhặt/tương tác/chạm vẫn tính XZ theo contract.
- Đêm mặc định 300 s, 3 sức sống. Khi kết thúc: đủ đèn ưu tiên thắng; tiếp theo hết sức sống; cuối cùng hết giờ. Thời gian hiển thị và snapshot chặn tại 0 ở bình minh.
- Điểm: +10/lần nhặt, +100/đèn sáng, +15/Bóng Mực trúng pulse. Khi thắng cộng `floor(time_left_s)*2 + flames*50`; thua giữ điểm đã kiếm. Nhặt lại đom đóm đã rơi vẫn là một sự kiện nhặt.
- `lit:true` trong scenario chuẩn hóa deposited về 10; deposited=10 được coi đã sáng. Chỉ cập nhật các ID được nêu, giữ nguyên đèn còn lại. Không cộng điểm hoặc tạo event lúc dựng scenario.
- Snapshot chỉ ghi tại tick 0 và các bội của snapshot-every; dòng end luôn cuối cùng kể cả dừng giữa hai snapshot. Không có input nghĩa là đứng yên.
- Input và scenario kiểm tra kiểu chặt chẽ; trường lạ hoặc ID trùng là lỗi. Không có dash trong Phase 1. UTF-8 có/không BOM đều được đọc.

## Đánh giá AI và harness

- Lỗi được phát hiện thật: AI giả định package Three.js có file `.min.js`; build lỗi ENOENT. Đã kiểm tra file trong dependency thực tế, đổi sang `three.module.js` + `three.core.js`, bổ sung một dòng AGENTS để tránh lặp.
- Khi thêm kiểm tra bàn phím, đã cho canvas nhận focus thật để việc chuyển từ nút bắt đầu sang game hoạt động rõ ràng; vẫn giữ focus ring cho các nút.
- Browser QA cảm ứng ban đầu đo từ tick trước khi khởi tạo thao tác chạm nên có thể thiếu quãng đường do thời gian thiết lập. Đã đổi điều kiện chờ sang vị trí thực tế. Bố cục điện thoại đã kiểm tra thêm khi HUD và nút cảm ứng cùng hiện.
- Kiểm thử và output do script tạo. `verify.mjs` kiểm tra exit code, kết quả expected, số sự kiện và độ giống từng byte; không dựa vào lời mô tả của AI.
- Hook pre-commit đã cài trong repo local bằng core.hooksPath; test lỗi chặn commit. CI Ubuntu/macOS bổ sung kiểm tra sau push. Người viết chưa có reviewer độc lập; kiểm thử tự động không được gọi là review của người khác.
- Chưa có luật Phase 2–4 để thay thế test; không tắt hoặc xóa test hồi quy nào.

## Phạm vi chưa hoàn thành của toàn bộ lab

Chưa nhận Ticket-02/03/04; chưa có tag phase-2/3/4 hoặc Release v1.0.0. Không xác nhận đã nộp LMS, đúng hạn ca học, hoặc đạt hidden tests của giảng viên. Chỉ ghi kết quả đã kiểm chứng thật.
