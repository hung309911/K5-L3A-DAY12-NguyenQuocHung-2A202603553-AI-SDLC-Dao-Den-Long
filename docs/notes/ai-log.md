# Nhật ký dùng AI

## Chuẩn bị — 21/11/2026

- Công cụ: Codex trong workspace Windows; GitHub connector để đọc repository giảng viên; TinyFish để đọc trang lab board công khai.
- Lời nhắc của người dùng: “làm bài này theo yêu cầu cho tôi”, kèm URL starter Day 12.
- Việc đã thực hiện: đọc sáu tài liệu starter, clone repository, giữ bản chụp tài liệu gốc, ghi bảng yêu cầu và harness.
- Giới hạn: chưa xem được dữ liệu lab board vì yêu cầu đăng nhập Claude. Đã yêu cầu người dùng cung cấp PRD-0, Test Contract và ticket được phát hành.
- Ước tính token phần chuẩn bị: khoảng 15.000–25.000 token tính cả tài liệu và metadata công cụ đã đọc; đây là ước tính thủ công, không phải số đo billing. Chi phí thực tế không truy cập được.
- Điều cần cải thiện: truy vấn metadata công cụ ban đầu quá rộng, tạo đầu ra dài; các lượt sau chỉ lấy công cụ cụ thể và nội dung cần dùng.
- Tiết kiệm tiếp theo: đọc contract trước khi chọn engine để tránh viết lại phần mô phỏng; không tìm hoặc sao chép repo bài làm của học viên khác.
- Chưa có nhật ký triển khai Phase 1–4, chưa chạy game, chưa có kết quả kiểm thử sản phẩm.

## Cập nhật — Phase 1 sau khi nhận tài liệu

- Người dùng bổ sung hai file dán văn bản; đã đọc toàn bộ, xác nhận đều là PRD-0 và Test Contract v1.0. Lưu nguyên văn trong `docs/requirements/` và trích contract ra file riêng.
- Công cụ triển khai: Codex, Node.js, npm, Three.js; skill Sites để chuẩn bị bản web, skill verification để kiểm tra luồng từ UI tới mô phỏng và HUD. Không dùng subagent.
- Thiết kế: Game mô phỏng thuần, renderer tách riêng, CLI và browser dùng cùng logic/config. Giá trị tuning là lựa chọn gameplay được PRD cho phép, khai báo đúng số đang chạy.
- Kiểm chứng thực hiện: 56 unit/CLI tests, bốn scenario expected, bot input chơi thắng màn mặc định, replay cùng seed so từng byte, Chrome thật với bàn phím và cảm ứng.
- Hai lỗi phát hiện và cách chỉnh được ghi trong `retro.md`; đã cập nhật AGENTS sau lỗi dependency, và sửa điều kiện chờ của browser QA sau lần đo cảm ứng không ổn định.
- Token phần triển khai Phase 1 ước tính thủ công khoảng 25.000–40.000; không có bộ đếm billing để xác nhận chi phí. Ước tính phần chuẩn bị ở trên là một giai đoạn riêng.
- Có pre-commit guard thật và workflow CI; không tự gọi mình là reviewer độc lập, không ghi hidden tests đạt khi chưa có kết quả.
- Lịch sử/tags giữ thời gian thực tế. Chưa triển khai Phase 2–4 vì người dùng chưa cung cấp các ticket tương ứng.
