# v0.2.1 — Sửa lỗi "Đã gạt công tắc, nhưng bảng điều khiển gốc của SillyTavern lại không thay đổi"

Đây là một **phiên bản sửa lỗi**. Nếu ở phiên bản trước bạn từng gặp tình trạng "Đã bật công tắc Worldbook trong plugin, plugin hiển thị là đã bật, nhưng bảng 'Worldbook đã bật' của chính SillyTavern lại vẫn chưa được bật" - thì phiên bản này chính là để sửa lỗi đó đây.

## Trước đây bị hỏng ở đâu

Plugin đã sửa đúng dữ liệu, nhưng lại **không sửa vào phần dữ liệu mà giao diện SillyTavern thực sự đọc**.

Trong SillyTavern có hai hàm trùng tên y hệt nhau, đều gọi là `saveSettingsDebounced`:

| Ở đâu | Làm gì |
|---|---|
| `world-info.js` dòng 84 (private) | Đồng bộ danh sách kích hoạt vào `world_info.globalSelect`, sau đó lưu vào ổ đĩa |
| `script.js` dòng 469 (export) | Chỉ lưu vào ổ đĩa, **không đụng chạm** đến `globalSelect` |

Plugin lúc đó đã import cái bên dưới. Thế là: Dữ liệu đã đổi ✅, `globalSelect` không đổi ❌. Mà phần hiển thị giao diện và đọc dữ liệu lưu của SillyTavern lại lấy chính xác từ `globalSelect` - cho nên bảng điều khiển cứ mãi hiển thị trạng thái cũ.

## Bây giờ sửa như thế nào

Sau khi sửa xong dữ liệu, sẽ **mượn kênh ghi ngược (write-back channel) của chính SillyTavern**:

1. Căn chỉnh trạng thái tick chọn của cái dropdown Worldbook trên giao diện SillyTavern cho khớp với ý muốn của chúng ta
2. Kích hoạt event `change` của nó
3. Hàm xử lý của chính SillyTavern sẽ tiếp quản: Đọc lại mục được chọn từ dropdown -> Ghi đè danh sách kích hoạt -> Đồng bộ `globalSelect` -> Lưu vào ổ đĩa -> Thông báo làm mới giao diện

Con đường này là logic gốc của SillyTavern, cho nên đương nhiên sẽ không bị mất đồng bộ.

## Tiện thể gia cố thêm hai chỗ

**Một, khi danh sách vẫn còn trống thì phải khởi động (warm-up) trước**

Cái dropdown đó của SillyTavern không phải sinh ra là đã có nội dung đâu, chỉ khi nào từng mở bảng Worldbook ra thì nó mới được lấp đầy. Nếu bạn chưa từng mở bao giờ, plugin sẽ tự động làm mới danh sách Worldbook một lần trước (tương đương với việc giúp bạn mở bảng đó lên một chút), sau đó mới thực thi công tắc. Bước này chỉ vẽ lại danh sách, không thay đổi nội dung, không ghi file.

**Hai, khi trong dropdown không có cuốn sách này, tuyệt đối không kích hoạt change**

Điểm này rất mấu chốt. Nếu cứ cố ép kích hoạt, SillyTavern sẽ dựa vào một cái dropdown trống không mà **ghi đè toàn bộ** danh sách kích hoạt, tương đương với việc âm thầm xóa sạch trạng thái của bạn. Vì vậy, plugin chỉ đi theo kênh ghi ngược khi đã xác nhận cuốn sách này có nằm trong dropdown.

## Xác minh

- **43 mục** assertion của logic công tắc (phiên bản trước là 22 mục). Mục quan trọng mới được thêm vào là lập mô hình riêng cho `globalSelect` - đây chính là điểm khác biệt giữa "dữ liệu đã đổi" và "giao diện SillyTavern đã đổi".
- Đã thực hiện **thử nghiệm đối chiếu ngược**: Bỏ lại implementation cũ vào chạy thử, bài test đã tái hiện chính xác hiện tượng mà bạn thấy (`globalSelect` bị kẹt ở giá trị cũ).
- Đã đối chiếu tính xác thực của từng cái một trong **11 symbol** của SillyTavern (bao gồm cả `updateWorldInfoList` mới thêm lần này), tất cả đều tồn tại trong mã nguồn 1.18.0.
- Kiểm tra cú pháp, mô phỏng load thật, kiểm tra bảng mã script PowerShell: Tất cả đều pass.

Tổng cộng **15 + 43 + 10 mục assertion + 11 symbol**, xanh toàn bộ.

## Cách nâng cấp

**Cài đặt từ Git URL**: Trên trang "Extensions" của SillyTavern, chỉ cần nhấp vào cập nhật cho extension này là được.

**Đặt thủ công**: Ghi đè các file `index.js`, `style.css`, `manifest.json` sang, sau đó khởi động lại SillyTavern hoặc tải lại trang.

> Lưu ý: Nếu extension của bạn được cài đặt ở `public/scripts/extensions/third-party/` (vị trí **mọi người đều thấy**), mà bạn lại không phải là admin, nút xóa của SillyTavern sẽ trả về lỗi 403 - đây là thiết kế phân quyền của SillyTavern, không phải lỗi của plugin. Khi cài lại, hãy chọn "Chỉ cài đặt cho tôi" thì sẽ không bị phiền toái này.

## Thay đổi hoàn chỉnh

- `index.js` — Mượn kênh `change` của SillyTavern để ghi ngược; thêm mới `ensureWorldListReady()` / `triggerWorldInfoChange()` / `paintToggle()`; `toggleWorld` được đổi thành bất đồng bộ (async)
- `_selftest_toggle.mjs` — 22 -> 43 mục
- `_verify_load.mjs` — Stub đồng bộ thêm các import mới
- `_verify_api.mjs` — Thêm phần đối chiếu `updateWorldInfoList`
- `README.md` — Bổ sung hướng dẫn tự kiểm tra, các hạn chế đã biết
- `manifest.json` — Số phiên bản 0.2.1, `homePage` trỏ về kho lưu trữ này