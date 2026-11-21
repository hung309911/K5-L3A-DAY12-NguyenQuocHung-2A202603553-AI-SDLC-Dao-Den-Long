# Hướng dẫn làm Day 12

- Đọc `docs/notes/requirements.md` và tài liệu gốc trong `docs/assignment/`.
- Trước khi thiết kế logic, cần PRD-0, Test Contract và ticket đã phát hành của phase tương ứng.
- Không suy đoán tên lệnh, schema JSON, tham số gameplay hoặc ngưỡng hiệu năng của bộ chấm.
- Khi đã có contract: tách mô phỏng khỏi hiển thị; cùng seed và input phải tái lập được theo contract.
- Mỗi yêu cầu có tiêu chí nghiệm thu và bằng chứng chạy thật. Output bằng chứng do chương trình sinh, không sửa tay.
- Sau mỗi thay đổi luật, ghi lý do thay đổi test và chạy lại kiểm chứng còn hiệu lực.
- Chỉ gắn tag phase khi có triển khai và bằng chứng đúng với commit đó. Không tạo lịch sử hoặc mốc thời gian giả.
- Giữ tài liệu harness trong lịch sử. Không sao chép bài của học viên khác.
- Không commit `.env`, khóa, token, thông tin đăng nhập hoặc dữ liệu cá nhân của người khác.
- Phase 1 đã nhận PRD-0 và Test Contract v1.0 từ người dùng trong `docs/requirements/`. Các số gameplay được tự chọn theo PRD và khai thật trong `game.contract.json`; không tự đặt yêu cầu Phase 2–4.
- Node.js >=22; `npm ci`, `npm run build`, `npm start`. Renderer Three.js; logic thuần trong `src/game.mjs` chạy chung cho web và headless.
- Test: `npm test`. Bằng chứng tái lập: `npm run verify`. Browser thật: `npm run test:browser` (Chrome/Chromium trên máy, hoặc QA_BROWSER).
- Cài guard thật: `git config core.hooksPath .githooks`. Hook pre-commit chạy kiểm chứng và chặn commit nếu kiểm tra lỗi; CI kiểm tra trên Ubuntu/macOS khi push.
- Khoảng cách luôn XZ, kể cả đang nhảy; snapshot 0 trước input; input tick k tạo event/state k+1; chỉ serialize mới làm tròn tọa độ.
- Three.js 0.187.0 chỉ có three.module.js/three.core.js trong package; kiểm tra file thực tế khi nâng dependency thay vì giả định có bản .min.js.
