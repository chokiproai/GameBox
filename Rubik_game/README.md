# NOIR³ — Cube Atelier

Một trải nghiệm Rubik 3D trình diễn theo phong cách sản phẩm cao cấp: khối 27 cubie bo góc, 54 ô ceramic, đế trưng bày phủ vàng, ánh sáng studio và âm thanh cơ học tổng hợp trực tiếp bằng Web Audio.

## Chạy trang

Trang dùng ES modules và font cục bộ, nên cần mở qua một static server (không mở trực tiếp bằng `file://`).

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Sau đó mở <http://127.0.0.1:4173/index.html>.

Có thể dùng bất kỳ static server nào khác, ví dụ `npx serve .`.

## Điều khiển

- **Kéo một ô màu** để xoay lớp đó; lớp bám theo con trỏ và tự khớp khi thả.
- **Kéo vùng nền** để xoay góc nhìn. **Cuộn chuột** hoặc **chụm hai ngón** để phóng to.
- **U / D / L / R / F / B** để xoay mặt; giữ **Shift** hoặc bật **NGƯỢC** để xoay ngược chiều.
- **Space** trộn khối, **Backspace** hoàn tác, **Home** xếp lại, **?** mở hướng dẫn.
- Nhấp đúp vùng nền để trở về góc máy ban đầu.

## Cấu trúc

- `index.html`, `styles.css` — giao diện và hệ thống hình ảnh.
- `app.js` — khởi động scene, điều khiển chuột/bàn phím/cảm ứng.
- `src/config.js` — màu, thông số khối, định nghĩa lượt xoay.
- `src/cube/` — hình học, vật liệu, ánh sáng, cơ cấu xoay và camera.
- `src/game.js` — trộn, hoàn tác, xếp lại, đồng hồ, nhật ký nước đi.
- `src/sound.js` — âm thanh cơ học tổng hợp.
- `src/ui.js` — trạng thái, toast, hộp thoại hướng dẫn.
- `vendor/` — Three.js r169 và RoundedBoxGeometry chạy cục bộ.
- `assets/fonts/` — Manrope và Cormorant Garamond (WOFF2) chạy cục bộ.

Không có phụ thuộc mạng khi chạy.
