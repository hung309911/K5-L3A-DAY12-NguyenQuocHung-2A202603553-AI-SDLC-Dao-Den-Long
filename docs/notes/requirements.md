# Tiếp nhận yêu cầu Day 12

Ngày chuẩn bị: 21/11/2026 (Asia/Bangkok).

## Nguồn

- Repository giảng viên: https://github.com/VinUni-AI20k/K5-L3-LAB-Day12-AI-SDLC
- Bản chụp tài liệu gốc: `docs/assignment/`.
- Lab board: https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW
- Board công khai yêu cầu đăng nhập. Sau đó người dùng đã bổ sung hai bản dán PRD-0 + Test Contract v1.0; lưu ở `docs/requirements/`. Hiện đã đủ yêu cầu Phase 1.

## Yêu cầu xác nhận được từ repository

| Yêu cầu | Cách kiểm chứng dự kiến | Trạng thái |
| --- | --- | --- |
| Game 3D góc nhìn thứ ba, Mây gom đom đóm, thắp Đèn Lồng Lớn, né Bóng Mực | Browser QA, scenario và replay màn mặc định | Phase 1 đạt local |
| Chạy trên macOS hoặc Linux | Web tĩnh, Node headless, CI Ubuntu/macOS | Chọn Three.js + Node; kết quả CI xem GitHub sau push |
| Headless theo Test Contract | 56 test và 5 lượt scenario/replay | Phase 1 v1.0 đạt bộ kiểm tra của bài; hidden tests chưa có |
| Bốn phase, tag phase-1 đến phase-4 | Kiểm tra từng tag và bằng chứng tương ứng | Đang bàn giao Phase 1; phase sau chờ ticket |
| Xử lý thay đổi giữa các phase | Diff yêu cầu, test hồi quy, ghi lý do đổi luật | Thiếu Ticket-02/03/04 |
| Release v1.0.0 có bản chạy được | Tải bản phát hành, chạy sạch | Chưa thực hiện |
| Video MP4 dưới 5 phút, link đầu README | `docs/demo/metadata.json`, video ghi hình thật | Đã có demo Phase 1 khoảng 60 s; cần cập nhật nếu luật mới đổi |
| Bằng chứng thật từng phase | Chạy lại tại đúng tag, so kết quả | Phase 1 trong `docs/proof/phase-1/`; chưa có phase sau |
| Harness, nhật ký AI, ước tính token và retro | AGENTS, hook pre-commit, verify, CI, docs/notes | Đã có cho Phase 1 |
| Credits, license, không lộ bí mật | Kiểm tra asset/phụ thuộc và file tracked | Mã mới MIT, credits đã ghi nguồn |
| Repo cá nhân public, đúng tên | Kiểm tra GitHub khi bàn giao | Đã tạo repo hung309911 theo đúng quy ước |

## Đầu vào cần bổ sung

Đặt nguyên văn tài liệu do người dùng cung cấp vào các đường dẫn sau; ghi nguồn và phase phát hành. Không lấy từ bài của học viên khác.

1. `docs/requirements/PRD-0.md`: mô tả Phase 1 — đã nhận.
2. `docs/requirements/TEST-CONTRACT.md`: lệnh chạy, file khai báo, input/output, đơn vị và các quy tắc bắt buộc — đã nhận.
3. `docs/requirements/Ticket-02.md`: nội dung Phase 2 đã phát hành.
4. `docs/requirements/Ticket-03.md`: nội dung Phase 3 đã phát hành.
5. `docs/requirements/Ticket-04.md`: nội dung Phase 4 đã phát hành, gồm ngưỡng và lệnh đo nếu có.

Nếu Test Contract nằm trong PRD hoặc ticket, có thể lưu thêm bản trích nguyên văn riêng để đối chiếu. Không điền nội dung giả hoặc giá trị tự đoán vào các file trên.

## Quyết định chuẩn bị

- Tên checkout và thông tin học viên lấy từ bài Day 11 có sẵn trong cùng workspace: Nguyễn Quốc Hưng, 2A202603553, K5-L3A.
- Giữ nguyên tài liệu gốc trong `docs/assignment/` và lịch sử từ starter.
- Remote giảng viên đặt tên `upstream`; `origin` là repo cá nhân hung309911.
- Chọn engine sau khi có contract; các quyết định và giả định Phase 1 xem `docs/notes/phase-1.md`.
- Chưa biết lịch ca học hoặc hạn cụ thể do Coach thông báo. Không suy ra thời hạn từ ngày hiện tại và không ghi lùi thời gian tag.

## Kế hoạch sau khi có đề chi tiết

Với từng phase: lập tiêu chí nghiệm thu → chọn scenario → triển khai bước nhỏ → chạy kiểm chứng thật → lưu bằng chứng và đánh giá → commit và tag. Sau Phase 4, kiểm tra cài sạch trong tối đa ba lệnh, đo hiệu năng theo ticket, quay demo và đóng gói Release. Việc công khai repo phải phản ánh đúng tình trạng bài tại thời điểm nộp.
