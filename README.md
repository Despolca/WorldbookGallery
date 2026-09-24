# Quản lý Ảnh bìa Worldbook / Worldbook Gallery

> Một tiện ích mở rộng cho SillyTavern. Hiển thị các Worldbook trải ra theo "nó được liên kết với thẻ nhân vật nào", mỗi cuốn Worldbook sẽ được dán kèm ảnh bìa của thẻ nhân vật đó.
> Khi có quá nhiều thẻ nhân vật và bạn không nhận ra Worldbook nào, chỉ cần nhìn lướt qua ảnh bìa là biết ngay đó là cuốn nào.

A SillyTavern extension that displays your World Info / Lorebooks as a gallery of character card covers — so you can tell which lorebook belongs to which card at a glance.

---

## Nó giải quyết vấn đề gì

Thẻ nhân vật được import vào càng nhiều, Worldbook cũng kéo theo tăng lên. Thẻ nhân vật thì dễ nhận diện — có tên, có ảnh bìa;
nhưng tên Worldbook thì có cái giống tên thẻ, có cái lại rất kỳ quặc, bẵng đi một thời gian quay lại chơi là không phân biệt được cuốn nào thuộc về thẻ nào.

Tiện ích này sẽ dán trực tiếp **ảnh bìa của thẻ nhân vật tương ứng với mỗi Worldbook** lên trên chính cuốn Worldbook đó.
Nhìn thấy hình, là biết ngay cuốn nào.

---

## Chỉ đọc, không thay đổi bất cứ thứ gì (ngoại trừ các công tắc do chính bạn gạt)

Đây là ranh giới đỏ trong thiết kế:

- **Không ghi bất kỳ file nào.** Tiện ích chỉ đọc xem "có những Worldbook nào", "có những thẻ nào", sau đó hiển thị ra.
- **Không sửa bất kỳ tên nào.** Tên file của Worldbook và thẻ nhân vật trên ổ cứng sẽ không bị thay đổi dù chỉ một chữ.
  Tên hiển thị trong bảng điều khiển được ghép lại lúc đang chạy (runtime), tắt đi là mất.
- **Không sửa nội dung thẻ.** Không ghi bất kỳ dữ liệu nào vào thẻ nhân vật.
- **Nhấp vào chỉ để mở lên xem.** Nhấp vào các ô sẽ gọi trình chỉnh sửa Worldbook có sẵn của SillyTavern lên, nếu bạn không thao tác thì nó sẽ không thay đổi gì cả.
- **Ngoại lệ duy nhất là công tắc trên thẻ.** Công tắc này kiểm soát xem "Worldbook hiện tại có đang bật hay không",
  cái thay đổi chính là danh sách kích hoạt trong phần cài đặt của SillyTavern — nó và việc bạn tự tick / bỏ tick trong giao diện của SillyTavern là **cùng một hành động**,
  không liên quan đến việc đọc ghi bất kỳ file nào.

Chỉ cần xóa thư mục của tiện ích là sẽ khôi phục hoàn toàn nguyên trạng, không để lại bất kỳ tàn dư nào.

---

## Trạng thái kích hoạt và công tắc

Góc dưới bên trái của mỗi thẻ Worldbook trong bảng điều khiển có một nhãn trạng thái (**Đã bật** / **Đã tắt**),
bên dưới có một nút công tắc, có thể gạt trực tiếp.

**Nó và giao diện của SillyTavern dùng chung một trạng thái, đồng bộ hai chiều:**

- Bạn tick chọn một cuốn Worldbook nào đó trong giao diện SillyTavern → thẻ này trong bảng điều khiển lập tức chuyển thành "Đã bật" (viền xanh lá sáng lên).
- Bạn gạt công tắc trong bảng điều khiển → danh sách kích hoạt của SillyTavern cũng thay đổi theo, SillyTavern cũng sẽ tự động hiện thông báo "Đã bật: xxx".

Hàng thống kê ở trên cùng sẽ hiển thị hiện tại đang bật tổng cộng bao nhiêu cuốn. Trên thanh công cụ còn có **"Chỉ xem các mục đã bật"**,
sau khi tick vào thì trong lưới sẽ chỉ còn lại các Worldbook đang có hiệu lực, giúp dễ dàng xác nhận "rốt cuộc những cuốn nào đang hoạt động".

> Điều này giải quyết chính xác vấn đề "Tôi không biết Worldbook có đang hoạt động hay không" — bây giờ chỉ cần liếc nhìn thẻ là rõ ngay.

---

## Nguyên lý

Nguồn gốc của mối quan hệ tương ứng này là **trường dữ liệu liên kết của chính thẻ nhân vật**:

```
character.data.extensions.world
```

Bên trong file PNG của mỗi thẻ nhân vật đều có ghi lại việc nó được liên kết với cuốn Worldbook nào. Đọc trường dữ liệu này,
là có thể gán ảnh bìa cho Worldbook một cách **chính xác** (chứ không phải dựa vào đoán tên).

Ngoài ra, nó cũng sẽ đọc `character.data.character_book` để nhận dạng các Worldbook **đi kèm theo thẻ nhưng chưa được import**.

> Tham khảo: `public/scripts/world-info.js` của SillyTavern, lân cận các dòng 1127, 4164, 5567, 6205.

---

## Cài đặt

### Cách 1: Cài đặt từ Git URL (Khuyên dùng)

Trong SillyTavern, nhấn vào **Extensions** → **Install Extension** → điền địa chỉ kho lưu trữ này vào, sau đó nhấn "Chỉ cài đặt cho tôi":

```
https://github.com/Despolca/WorldbookGallery
```

Sau khi cài xong, hãy **làm mới (refresh) trang SillyTavern**.

### Cách 2: Đặt thủ công

Đặt toàn bộ thư mục vào:

```
<SillyTavern>/public/scripts/extensions/third-party/worldbook-gallery
```

### Cách 3: Dùng script đính kèm (Windows)

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

## Cách sử dụng

1. Nhấp vào **Cài đặt Extensions** (biểu tượng phích cắm) ở góc trên bên phải SillyTavern.
2. Tìm mục **"Quản lý Ảnh bìa Worldbook"**, rồi mở rộng nó ra.
3. Nhấp vào **"Mở bảng ảnh bìa"**.

Một bảng điều khiển sẽ trượt ra từ bên phải, các Worldbook sẽ được trải ra theo ảnh bìa.

### Giải thích bảng điều khiển

| Thành phần | Ý nghĩa |
|---|---|
| Hình ảnh phía trên | Ảnh bìa của thẻ nhân vật được liên kết với Worldbook này |
| Nhãn trạng thái góc dưới bên trái | **Đã bật** / **Đã tắt** |
| Chữ in đậm | Tên hiển thị, mặc định là "Tên thẻ · Tên Worldbook" |
| Chữ nhỏ | Số lượng mục (entries), và tên file thật của Worldbook |
| "N thẻ" ở góc trên bên phải | Có nhiều thẻ cùng dùng chung Worldbook này |
| Công tắc phía dưới | Nhấp để bật / tắt, đồng bộ với giao diện SillyTavern |

### Phân biệt qua thị giác

- **Viền xanh lá, sáng lên, nhãn trạng thái ghi "Đã bật"** —— Cuốn này đang có hiệu lực.
- **Bị tối đi, nhãn trạng thái ghi "Đã tắt"** —— Cuốn này không có hiệu lực.

### Ba trạng thái đặc biệt sẽ được đánh dấu

- **Khung nét đứt màu xám** —— Cuốn Worldbook này không có thẻ nào đang sử dụng (mục bị cô lập, thường có thể dọn dẹp).
- **Viền màu cam, thông báo "Trong thẻ có ghi, nhưng file Worldbook không tồn tại"** —— Có thẻ chỉ định dùng nó, nhưng file đã mất.
  Trường hợp này khi vào game sẽ xảy ra lỗi.
- **Vị trí hình ảnh hiển thị icon file** —— Không có thẻ nào liên kết, do đó không có ảnh bìa để hiển thị.

### Thanh công cụ

- **Khung tìm kiếm** —— Lọc theo tên thẻ hoặc tên Worldbook.
- **Kiểu hiển thị** —— "Tên thẻ · Tên Worldbook" / "Chỉ hiển thị tên thẻ" / "Chỉ hiển thị tên Worldbook".
- **Hiển thị Worldbook chưa liên kết** —— Bỏ tick để ẩn các mục bị cô lập.
- **Chỉ xem các mục đã bật** —— Chỉ hiển thị các Worldbook hiện đang có hiệu lực.
- **Quét lại** —— Làm mới thủ công sau khi import nội dung mới.

---

## Độ chính xác khi ghép nối

Phụ thuộc vào việc thẻ nhân vật được đưa vào SillyTavern bằng cách nào:

| Phương thức import | Kết quả ghép nối |
|---|---|
| **Import nguyên thẻ** (Worldbook đi kèm theo thẻ) | **Chính xác**. Bản thân thẻ có ghi lại mối quan hệ liên kết, không cần đoán. |
| Import thẻ và Worldbook tách rời nhau | Một phần sẽ không thể ghép nối, và sẽ hiển thị thành "Chưa liên kết thẻ". |

Khuyên dùng cách import nguyên thẻ.

---

## Tự kiểm tra (Self-test)

Trong kho lưu trữ có đính kèm các script tự kiểm tra không phụ thuộc vào trình duyệt:

```bash
node _selftest.mjs              # Logic ghép nối, 15 mục
node _selftest_toggle.mjs       # Logic công tắc, 43 mục
node _verify_load.mjs           # Mô phỏng load thật (Xác minh cài được và chạy được)
node _verify_ps1_encoding.mjs   # Bảng mã script PowerShell, 10 mục
node _verify_api.mjs            # Đối chiếu các symbol SillyTavern được dùng có thực sự tồn tại, 11 cái
```

- `_selftest.mjs` bao phủ 15 assertion của logic ghép nối (liên kết bình thường, hậu tố sinh ra do import trùng tên,
  Worldbook bị cô lập, Worldbook bị thiếu, Worldbook đi kèm theo thẻ, ba kiểu tên hiển thị, v.v.).
- `_selftest_toggle.mjs` bao phủ 43 assertion của logic công tắc (đọc trạng thái, bật, tắt,
  không thao tác trùng lặp, chỉ định tường minh, dự phòng (fallback) cho tên chứa dấu phẩy, không giả vờ thành công khi thất bại, tên rỗng,
  **mượn kênh change của SillyTavern để ghi ngược lại xem có thực sự đồng bộ vào `globalSelect` không**,
  **không được xóa nhầm trạng thái khi dropdown không có cuốn sách này**, **khi dropdown vẫn còn trống thì phải khởi động (warm-up) trước**, v.v.).
- `_verify_load.mjs` sẽ tạo ra một cây thư mục SillyTavern giả và tiến hành `import()` thật một lần,
  để xác nhận tiện ích có thể load, hook tồn tại, và `init` có thể chạy được.
- `_verify_ps1_encoding.mjs` xác nhận `install.ps1` có UTF-8 BOM (nếu không có thì
  Windows PowerShell 5.1 sẽ đọc tiếng Trung thành GBK, làm script không thể chạy được).
- `_verify_api.mjs` đối chiếu từng symbol mà tiện ích này import từ mã nguồn SillyTavern xem có thực sự tồn tại hay không
  (dùng `TAVERN_ROOT=/path/to/SillyTavern node _verify_api.mjs` để chỉ định thư mục SillyTavern).
  Import một symbol không tồn tại sẽ làm toàn bộ tiện ích thất bại khi load, nên bước này bắt buộc phải chạy một lần trên thư mục SillyTavern thật.

---

## Các hạn chế đã biết

- Nếu trong tên Worldbook **có chứa dấu phẩy**, công tắc trên bảng điều khiển sẽ bỏ qua kênh lệnh gạch chéo (slash command) của SillyTavern,
  chuyển sang cách thao tác trực tiếp trên dropdown của giao diện. Chức năng thì giống nhau, nhưng nếu có lúc nào đó không hoạt động,
  bạn có thể xem log trong console của trình duyệt (có tiền tố `[Worldbook Gallery]`).
- Công tắc chỉ điều khiển danh sách **kích hoạt toàn cục**. SillyTavern còn có hai cơ chế độc lập là "Liên kết theo thẻ nhân vật" và "Liên kết theo đoạn chat",
  tiện ích này không can thiệp vào hai cơ chế đó.
- Nếu bảng Worldbook của SillyTavern chưa từng được mở ra, tiện ích này sẽ tự động làm mới danh sách Worldbook một lần trước
  (tương đương với việc giúp bạn mở bảng đó lên một chút), sau đó mới thực thi công tắc. Bước này chỉ vẽ lại danh sách, không thay đổi nội dung, không ghi file.

---

## Độ tương thích

- Việc phát triển và xác minh được dựa trên **SillyTavern 1.18.0**.
- Phụ thuộc vào các export của `public/scripts/world-info.js` và `public/scripts/script.js`,
  hai file này có thể sẽ thay đổi khi SillyTavern cập nhật.

---

## Tuyên bố miễn trừ trách nhiệm

Đây là tiện ích mở rộng của bên thứ ba. Vui lòng tự đánh giá trước khi sử dụng. Bản thân tiện ích không ghi bất kỳ dữ liệu nào,
nhưng phía chính thức của SillyTavern sẽ không chịu trách nhiệm cho bất kỳ tổn thất nào do tiện ích của bên thứ ba gây ra.

## License

MIT