# Quản lý Ảnh bìa Worldbook v0.2.0

> Hiển thị các Worldbook trải ra theo "nó được liên kết với thẻ nhân vật nào", mỗi cuốn Worldbook sẽ được dán kèm ảnh bìa của thẻ nhân vật đó.
> Phiên bản này bổ sung: **Nhìn một phát là thấy ngay trạng thái kích hoạt + Bật/tắt trực tiếp trong bảng điều khiển, đồng bộ hai chiều với SillyTavern.**

---

## Phiên bản này có gì mới

### 1. Nhìn một phát là biết ngay Worldbook có đang bật hay không

Góc dưới bên trái mỗi thẻ có một nhãn trạng thái:

- **Đã bật** - Thẻ có một vòng viền xanh lá, tổng thể sáng lên
- **Đã tắt** - Tổng thể thẻ bị tối đi

Khi có nhiều thẻ nhân vật được import vào, Worldbook cũng kéo theo tăng lên,
"rốt cuộc những cuốn nào đang hoạt động" trước đây phải click mở từng cái trong giao diện SillyTavern để xem, giờ chỉ cần liếc nhìn bảng điều khiển là biết.

### 2. Bật/tắt trực tiếp trong bảng điều khiển, đồng bộ hai chiều với SillyTavern

Phía dưới thẻ có thêm một nút công tắc, nhấp một cái là có thể bật / tắt cuốn Worldbook này.

- **Gạt công tắc trong bảng điều khiển** -> Trạng thái Worldbook bên phía SillyTavern cũng thay đổi theo, SillyTavern sẽ tự động hiện thông báo "Đã bật: xxx"
- **Tick chọn trong giao diện SillyTavern** -> Thẻ này trong bảng điều khiển lập tức chuyển thành "Đã bật", không cần làm mới thủ công

Cả hai bên thao tác trên **cùng một trạng thái**, sẽ không xảy ra tình trạng "bảng điều khiển bảo đang bật, SillyTavern bảo đang tắt".

### 3. Thống kê trên cùng + "Chỉ xem các mục đã bật"

- Hàng thống kê bây giờ sẽ ghi "**N cuốn đã bật**"
- Thanh công cụ thêm bộ lọc "**Chỉ xem các mục đã bật**", sau khi tick vào thì trong lưới sẽ chỉ còn lại các Worldbook đang có hiệu lực

---

## Cách sử dụng

Sau khi cài xong (cách cài đặt xem bên dưới), nhấp vào **biểu tượng phích cắm (Cài đặt Extensions)** ở góc trên bên phải SillyTavern -> tìm mục **"Quản lý Ảnh bìa Worldbook"** -> nhấp vào **"Mở bảng ảnh bìa"**.

Một bảng điều khiển sẽ trượt ra từ bên phải:

| Vị trí | Là gì |
|---|---|
| Hình ảnh phía trên | Ảnh bìa của thẻ nhân vật được liên kết với Worldbook này |
| Nhãn nhỏ góc dưới bên trái | **Đã bật** / **Đã tắt** |
| Chữ in đậm | Tên hiển thị, mặc định là "Tên thẻ · Tên Worldbook" |
| Chữ nhỏ | Số lượng mục (entries) + Tên file thật của Worldbook |
| "N thẻ" ở góc trên bên phải | Có nhiều thẻ cùng dùng chung Worldbook này |
| Hàng dưới cùng | Nút công tắc + Dòng chữ trạng thái |

Nhấp vào vị trí bất kỳ trên thẻ sẽ mở trình chỉnh sửa Worldbook có sẵn của SillyTavern (chỉ đọc xem);
Nhấp vào công tắc chỉ thay đổi trạng thái kích hoạt, sẽ không bị chạm nhầm mở trình chỉnh sửa lên.

---

## Cài đặt / Cập nhật

### Cài đặt từ Git URL (Khuyên dùng)

Trong SillyTavern, nhấn vào **Extensions** -> **Install Extension** -> điền vào:

```
https://github.com/Despolca/WorldbookGallery
```

Nhấp vào "**Chỉ cài đặt cho tôi**", sau đó **làm mới trang SillyTavern**.

### Cập nhật lên phiên bản này

- Những ai đã cài từ Git URL: Nhấp vào **Cập nhật** trong danh sách extension (hoặc trực tiếp làm mới trang),
  sẽ tự động kéo code của phiên bản này về.
- Cài đặt thủ công: Thay thế toàn bộ thư mục `worldbook-gallery`, làm mới trang.

### Đặt thủ công

Đặt toàn bộ thư mục vào:

```
<SillyTavern>/public/scripts/extensions/third-party/worldbook-gallery
```

### Script Windows

```powershell
.\install.ps1 -Action install      # Cài đặt
.\install.ps1 -Action update       # Cập nhật (sẽ sao lưu phiên bản cũ trước)
.\install.ps1 -Action uninstall    # Gỡ cài đặt
.\install.ps1 -Action status       # Kiểm tra xem đã cài chưa
```

Script sẽ tự động tìm kiếm thư mục SillyTavern; nếu không tìm thấy, có thể chỉ định thủ công:

```powershell
.\install.ps1 -Action install -TavernRoot "D:\SillyTavern"
```

---

## Khắc phục một hố (Nếu cài bằng script Windows thì xin lưu ý)

Trước đây `install.ps1` **không có UTF-8 BOM**. Windows PowerShell 5.1 khi gặp loại file này sẽ
dựa theo code page ANSI của hệ thống (hệ thống tiếng Trung là GBK) để giải mã, các chú thích tiếng Trung trong script sẽ biến thành chữ rác hết,
trình phân tích cú pháp (parser) sẽ báo lỗi kiểu "thiếu dấu ngoặc đóng" ở những vị trí khó hiểu, làm script không thể chạy được.

Phiên bản này đã thêm BOM vào file, đồng thời bổ sung một script tự kiểm tra `_verify_ps1_encoding.mjs`
để giám sát việc này, phòng ngừa tái phạm về sau.

Nếu dùng cách "Cài đặt từ Git URL" của SillyTavern thì không bị ảnh hưởng - cách đó không chạy qua script này.

---

## Về vấn đề "Chỉ đọc"

Ranh giới đỏ trong thiết kế của tiện ích này là **không đụng chạm vào đồ của bạn**:

- Không ghi bất kỳ file nào
- Không sửa bất kỳ tên nào của Worldbook, thẻ nhân vật trên ổ cứng
- Không ghi bất kỳ dữ liệu nào vào thẻ nhân vật
- Tên hiển thị được ghép lại tạm thời lúc đang chạy (runtime), tắt đi là mất

**Ngoại lệ duy nhất là công tắc trên thẻ đó** - nó thay đổi danh sách "hiện tại những Worldbook nào đang bật" trong phần cài đặt của SillyTavern,
và việc bạn tự tick, bỏ tick trong giao diện SillyTavern là **cùng một hành động**, không liên quan đến việc đọc ghi bất kỳ file nào.

Chỉ cần xóa thư mục của tiện ích là sẽ khôi phục hoàn toàn nguyên trạng, không để lại bất kỳ tàn dư nào.

---

## Nguyên lý

Nguồn gốc của mối quan hệ tương ứng này là **trường dữ liệu liên kết của chính thẻ nhân vật**:

```
character.data.extensions.world
```

Bên trong file PNG của mỗi thẻ nhân vật đều có ghi lại việc nó được liên kết với cuốn Worldbook nào. Đọc trường dữ liệu này,
là có thể gán ảnh bìa cho Worldbook một cách **chính xác** (chứ không phải dựa vào đoán tên).

Ngoài ra, nó cũng sẽ đọc `character.data.character_book` để nhận dạng các Worldbook **đi kèm theo thẻ nhưng chưa được import**.

---

## Độ chính xác khi ghép nối

| Phương thức import | Kết quả ghép nối |
|---|---|
| **Import nguyên thẻ** (Worldbook đi kèm theo thẻ) | **Chính xác**. Bản thân thẻ có ghi lại mối quan hệ liên kết, không cần đoán. |
| Import thẻ và Worldbook tách rời nhau | Một phần sẽ không thể ghép nối, và sẽ hiển thị thành "Chưa liên kết thẻ". |

Khuyên dùng cách import nguyên thẻ.

---

## Tự kiểm tra (Dành cho nhà phát triển)

Trong kho lưu trữ có đính kèm các script tự kiểm tra không phụ thuộc vào trình duyệt:

```bash
node _selftest.mjs              # Logic ghép nối, 15 mục
node _selftest_toggle.mjs       # Logic công tắc, 22 mục
node _verify_load.mjs           # Mô phỏng load thật (Xác minh cài được và chạy được)
node _verify_ps1_encoding.mjs   # Bảng mã script PowerShell, 10 mục
```

- `_selftest.mjs` - 15 assertion của logic ghép nối (liên kết bình thường, hậu tố sinh ra do import trùng tên,
  Worldbook bị cô lập, Worldbook bị thiếu, Worldbook đi kèm theo thẻ, ba kiểu tên hiển thị, v.v.)
- `_selftest_toggle.mjs` - 22 assertion của logic công tắc (đọc trạng thái, bật, tắt, không thao tác trùng lặp,
  chỉ định tường minh, dự phòng (fallback) cho tên chứa dấu phẩy, không giả vờ thành công khi thất bại, tên rỗng, v.v.)
- `_verify_load.mjs` - Tạo ra một cây thư mục SillyTavern giả và tiến hành `import()` thật một lần,
  xác nhận tiện ích có thể load, hook tồn tại, và `init` có thể chạy được
- `_verify_ps1_encoding.mjs` - Xác nhận `install.ps1` có UTF-8 BOM,
  là chuẩn UTF-8 hợp lệ, tiếng Trung không bị hỏng, và cả bốn action đều tồn tại

Tất cả đều vượt qua (pass): **15 + 22 + 10 assertion, cộng thêm mô phỏng load thật, 0 thất bại**.

---

## Các hạn chế đã biết

- Nếu trong tên Worldbook **có chứa dấu phẩy**, công tắc trên bảng điều khiển sẽ bỏ qua kênh lệnh gạch chéo (slash command) của SillyTavern,
  chuyển sang cách thao tác trực tiếp trên dropdown của giao diện. Chức năng thì giống nhau, rủi như có lúc nào đó không hoạt động thì có thể xem log
  trong console của trình duyệt (có tiền tố `[Worldbook Gallery]`).
- Công tắc chỉ điều khiển danh sách **kích hoạt toàn cục**. SillyTavern còn có hai cơ chế độc lập là "Liên kết theo thẻ nhân vật" và "Liên kết theo đoạn chat",
  tiện ích này không can thiệp vào hai cơ chế đó.

---

## Độ tương thích

- Việc phát triển và xác minh được dựa trên **SillyTavern 1.18.0**
- Phụ thuộc vào các export của `public/scripts/world-info.js` và `public/script.js`,
  hai file này có thể sẽ thay đổi khi SillyTavern cập nhật

---

## Thay đổi về file (0.1.0 -> 0.2.0)

Thêm mới:
- `_selftest_toggle.mjs` - Tự kiểm tra logic công tắc, 22 mục
- `_verify_ps1_encoding.mjs` - Tự kiểm tra bảng mã script PowerShell, 10 mục

Sửa đổi:
- `index.js` - Thêm mới `isWorldEnabled()` / `toggleWorld()` /
  `setWorldEnabledViaSelect()`; `buildCard()` thêm nhãn trạng thái và công tắc;
  thêm mới `onToggleClick()`, `refreshStatsOnly()`, tự viết `toast()`;
  lắng nghe `WORLDINFO_SETTINGS_UPDATED` để thực hiện đồng bộ hai chiều; thanh công cụ thêm "Chỉ xem các mục đã bật"
- `style.css` - Style cho công tắc, nhãn trạng thái, hiệu ứng thị giác khi bật/tắt thẻ, thông báo góc dưới bên phải
- `manifest.json` - Phiên bản 0.1.0 -> 0.2.0
- `install.ps1` - Thêm mới action `update` (có sao lưu); **Bổ sung UTF-8 BOM**,
  sửa triệt để lỗi script không thể chạy được do tiếng Trung biến thành chữ rác trên PowerShell 5.1
- `README.md` / `GUIDE-zh.md` - Bổ sung giải thích về chức năng công tắc
- `_verify_load.mjs` - Các stub module (module giả) được bổ sung export cho `selected_world_info` / `onWorldInfoChange`

---

## License

MIT

---

**Full Changelog**: Không có (Đây là bản Release đầu tiên, kho lưu trữ trước đây chưa từng gắn tag)