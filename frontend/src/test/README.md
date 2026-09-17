# Kiểm thử frontend (Vitest + Testing Library)

## Chạy test

```powershell
cd frontend
npm run test        # chạy 1 lần
npm run test:watch  # chế độ watch
```

## Cấu trúc

- `src/test/setup.ts` — cấu hình môi trường jsdom + cleanup DOM sau mỗi test.
32 testcase, bao phủ mọi nhánh có thể xảy ra:

### `src/auth/__tests__/LoginPage.test.tsx` (13)

- Nội dung cơ bản: tiêu đề + lời nhắc đăng nhập luôn hiển thị.
- Khởi tạo GIS: dùng `window.google` có sẵn (không thêm script) và render button đúng cấu hình.
- Chưa có `window.google` → tự thêm `<script>`, khởi tạo khi `onload`.
- `onload` chạy nhưng `window.google` chưa sẵn sàng → bỏ qua an toàn.
- Script tải lỗi → component không crash (không gán `onerror`).
- Callback: đăng nhập thành công / lỗi `Error` / lỗi không phải `Error` (message mặc định).
- Lỗi cũ được xoá khi lần đăng nhập sau thành công.
- Callback gọi nhiều lần không làm treo UI.
- Tích hợp `useAuth`: login cập nhật `user` trong context.
- Regression: `LoginPage` nằm trong `AuthProvider` không ném lỗi Rules of Hooks.
- Regression kiểm tra mã nguồn: nhánh thiếu `VITE_GOOGLE_CLIENT_ID` dùng `setError`,
  không gọi `useAuth("...")` như hàm thường.

### `src/auth/__tests__/AuthContext.test.tsx` (8)

- `useAuth` dùng ngoài `<AuthProvider>` → ném đúng thông báo lỗi.
- `loading` true → false và gán `user` khi fetch thành công.
- `user = null` khi chưa đăng nhập.
- Vẫn tắt `loading` khi `fetchCurrentUser` ném lỗi (nhánh `.finally`).
- `login` thành công cập nhật `user`; `login` thất bại giữ nguyên `user` cũ.
- `logout` xoá token + đặt `user = null`; gọi nhiều lần vẫn an toàn.

### `src/services/__tests__/authService.test.ts` (11)

- `getToken` / `setToken` / `clearToken`.
- `loginWithGoogle`: 200 (lưu token), fetch reject, lỗi JSON có `detail`,
  body không parse được, body thiếu `detail`.
- `fetchCurrentUser`: không có token (không gọi mạng), token hợp lệ,
  gửi header `Bearer`, backend 401 (xoá token), lỗi mạng (giữ token).

## Ghi chú
- `VITE_GOOGLE_CLIENT_ID` được đọc ở phạm vi module nên `vi.stubEnv` không
  thay đổi được giá trị trong test. Vì vậy các test liên quan tới "thiếu client id"
  được tách thành: (a) kiểm tra hành vi không phụ thuộc client id, và
  (b) kiểm tra mã nguồn bằng truy vấn `?raw`.
- `vite.config.ts` đặt `maxWorkers: 1`; trên máy nhiều nhân có thể bỏ để chạy nhanh hơn.
