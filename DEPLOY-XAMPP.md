# Chia sẻ ứng dụng qua XAMPP

## Cổng và build

- **Frontend (dev):** chạy tại **http://localhost:5713** (đã đổi từ 8080 sang 5713).
- **Build cho XAMPP:** ứng dụng được build với base path `/mm/` và copy vào thư mục htdocs của XAMPP.

## Cách build và copy lên XAMPP

1. Cài XAMPP và bật **Apache**.
2. Trong thư mục gốc dự án chạy **một lệnh**:

   ```bash
   npm run build:xampp
   ```

   Lệnh này sẽ:
   - Build frontend với base path `/mm/` (phù hợp khi chạy tại `http://localhost/mm/`).
   - **Tự động copy** toàn bộ thư mục `dist` vào htdocs của XAMPP:
     - **Windows:** `C:\xampp\htdocs\mm`
     - **Linux:** `/opt/lampp/htdocs/mm`
   - Muốn đổi thư mục đích: đặt biến môi trường `XAMPP_HTDOCS` trước khi chạy, ví dụ:
     ```bash
     set XAMPP_HTDOCS=D:\xampp\htdocs\mm
     npm run build:xampp
     ```

3. Mở trình duyệt:
   - Trên máy cài XAMPP: **http://localhost/mm/**
   - Từ máy khác trong mạng LAN: **http://&lt;IP-máy-chủ&gt;/mm/** (nếu Apache lắng nghe trên mọi interface).

## Backend API

- Ứng dụng gọi API qua biến `VITE_API_URL` (mặc định `http://localhost:3001`).
- Khi chia sẻ qua XAMPP, backend **vẫn chạy riêng** (Node.js), không chạy qua Apache.
- Để máy khác dùng được:
  1. Chạy backend trên máy có XAMPP, ví dụ: `cd backend && npm run dev`.
  2. Trên máy đó, trong thư mục gốc dự án tạo/sửa file `.env` (frontend) và đặt:
     ```env
     VITE_API_URL=http://<IP-máy-chủ>:3001
     ```
  3. Chạy lại `npm run build:xampp` rồi copy lại thư mục `mm` trong htdocs (hoặc dùng chung bản build đã set đúng `VITE_API_URL`).

## Tóm tắt

| Mục           | Giá trị                          |
|---------------|-----------------------------------|
| Port frontend (dev) | **5713**                    |
| Build XAMPP   | `npm run build:xampp`             |
| Thư mục đích  | `C:\xampp\htdocs\mm` (hoặc `XAMPP_HTDOCS`) |
| URL trên trình duyệt | http://localhost/mm/ hoặc http://&lt;IP&gt;/mm/ |
| Backend       | Chạy riêng tại port 3001, cấu hình qua `VITE_API_URL` |
