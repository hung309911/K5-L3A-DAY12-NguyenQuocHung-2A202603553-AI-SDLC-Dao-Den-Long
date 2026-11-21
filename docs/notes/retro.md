# Retro Phase 1

- Đã làm: một game 3D Đêm 1, headless contract v1.0, 56 test, bốn scenario, một replay thắng màn mặc định, browser QA và demo ghi hình thật.
- Cách hiệu quả: đọc contract trước khi chọn engine, một mô phỏng chung, kiểm thử bán kính/tick/cạnh nút từ đầu. Bot chơi màn mặc định bổ sung bằng chứng rằng những scenario nhỏ không che mất vấn đề khả năng chơi được.
- Lỗi thực tế: giả định sai tên file build của Three.js làm build ENOENT; kiểm tra package rồi sửa. Bài test cảm ứng đầu tiên dùng mốc tick trước khi bắt đầu chạm, khiến thời gian thiết lập CDP bị tính nhầm vào thời gian giữ nút; đã đổi sang chờ vị trí nhân vật thực sự di chuyển đủ xa. Không sửa game để làm test giả đạt.
- Harness hữu ích: AGENTS ngắn nhắc XZ và tick; verify kiểm tra giá trị kết quả và so output từng byte; pre-commit tự chạy verify, CI kiểm tra hai hệ điều hành sau push.
- Tiết kiệm token: không đưa Three.js vào headless, không tạo asset bitmap hoặc thêm framework UI; renderer dùng mô hình hình học tự tạo. Quá trình đọc metadata công cụ ban đầu quá rộng là phần cần cải thiện.
- Ước tính thủ công cho phần triển khai Phase 1: khoảng 25.000–40.000 token, không phải số liệu billing; chi phí thực tế không có dữ liệu. Bao gồm việc đọc spec, thiết kế, code, test và tài liệu.
- Giới hạn: chưa có reviewer độc lập hoặc hidden tests; chưa có nội dung Phase 2–4 và ngưỡng hiệu năng Phase 4. Demo dùng điều khiển tự động và replay, được gắn nhãn rõ. Không biết lịch ca học để xác nhận nộp đúng hạn.
- Nếu làm lại: truy vấn công cụ hẹp ngay từ đầu, kiểm tra cấu trúc dependency trước khi viết build script; dùng điều kiện vị trí thay vì thời gian chờ trong browser QA.

Số liệu cụ thể và cấu hình máy nằm trong `docs/proof/phase-1/verification.json`; kiểm tra trình duyệt nằm ở `browser.json`. Các số thời gian mô phỏng không được dùng làm số đo hiệu năng đồ họa.
