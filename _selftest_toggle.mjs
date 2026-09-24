/**
 * Tự kiểm tra logic công tắc (không phụ thuộc vào SillyTavern).
 *
 * Ở đây không import index.js (nó cần môi trường SillyTavern thật), mà sẽ lấy các
 * logic isWorldEnabled / toggleWorld / syncWorldInfoSelect / triggerWorldInfoChange
 * bên trong viết lại theo cùng một hướng suy nghĩ, sau đó làm giả một selected_world_info + một cái dropdown #world_info giả,
 * để xác minh:
 *   - Công tắc có thể thay đổi được dữ liệu thật
 *   - Có thể đọc ngược lại trạng thái thật
 *   - Khi thất bại không được giả vờ là đã thành công
 *   - Tên có chứa dấu phẩy vẫn có thể thay đổi như thường (bản implement mới không chia cắt tên)
 *   - ★ Có thể mượn kênh change của chính SillyTavern để ghi ngược lại thay đổi (bug được sửa ở bản 0.2.1)
 *   - ★ Khi trong dropdown không có cuốn sách này, tuyệt đối không được kích hoạt change (nếu không sẽ làm trống trạng thái)
 *
 * Lưu ý: Đây là kiểm tra "tính nhất quán của logic", không phải kiểm tra "đoạn code trong index.js".
 * Việc kiểm tra code thật do _verify_load.mjs đảm nhiệm (load thật + export thật).
 */

let pass = 0, fail = 0;
function ok(name) { pass++; console.log(`  ✅ ${name}`); }
function no(name, extra) { fail++; console.log(`  ❌ ${name}${extra ? ' -> ' + extra : ''}`); }

// ---- Mô phỏng "danh sách kích hoạt toàn cục" của SillyTavern ----
// Trong thế giới thực nó là `export let selected_world_info = []` trong world-info.js,
// Cái được export là bản thân cái mảng, nên bên ngoài có thể push / splice trực tiếp tại chỗ (không thể gán lại giá trị cho toàn bộ mảng).
let selectedWorldInfo = ['Worldbook A', 'Worldbook B'];

// "Có những Worldbook nào" trong SillyTavern
const worldCatalog = ['Worldbook A', 'Worldbook B', 'Worldbook C', 'Worldbook D', 'Sach,Co,Dau,Phay', 'Sach khac', 'Sach giu nguyen'];

// ---- Mô phỏng dropdown #world_info ----
// Trong thế giới thực nó là <select multiple>, text của option = tên Worldbook.
// onWorldInfoChange('__notSlashCommand__') của SillyTavern sẽ:
//   val() -> đọc lại tất cả các option được chọn (ở đây là index của nó)
//   -> map thành tên -> **ghi đè toàn bộ** selected_world_info
//   -> lưu vào ổ đĩa + phát event
// Stub (module giả) này của chúng ta chính là diễn lại y xì quá trình này.
let dropdownOptions = [];      // [{ text, selected }]
let changeHandler = null;      // Hàm xử lý mà SillyTavern bind vào event change
let changeTriggered = 0;       // Đã kích hoạt mấy lần
let saveCalls = 0;             // Bên phía SillyTavern đã lưu vào ổ đĩa mấy lần

// ★ Đây mới là "thứ mà giao diện SillyTavern / lưu vào ổ đĩa thực sự đọc".
//   Trong thế giới thực là world_info.globalSelect, chỉ được đồng bộ bên trong cái hàm saveSettingsDebounced
//   **private** ở dòng 84 của world-info.js (dòng 85 Object.assign).
//   Cái hàm cùng tên được import từ script.js sẽ không đụng chạm đến nó - đây chính là nguyên nhân gốc rễ của cái bug ở phiên bản trước.
//   Vì vậy ở đây tạo riêng một biến để đại diện cho nó, dùng để xác minh "phía SillyTavern rốt cuộc có theo kịp hay không".
let globalSelectMirror = null;

function rebuildDropdown() {
    dropdownOptions = worldCatalog.map(t => ({ text: t, selected: selectedWorldInfo.includes(t) }));
}

/** Của chính SillyTavern: Đọc lại mục đang được chọn của dropdown, ghi đè lên dữ liệu thật */
function onWorldInfoChangeNative() {
    if (worldCatalog.length === 0) return;   // Tương ứng với câu early return của SillyTavern
    const picked = dropdownOptions.filter(o => o.selected).map(o => o.text);
    selectedWorldInfo = picked;              // Ghi đè
    saveCalls++;
    // SillyTavern đi theo hàm saveSettingsDebounced private của nó, bên trong đó sẽ đồng bộ globalSelect
    globalSelectMirror = selectedWorldInfo;
}

/** Stub: Event change của '#world_info' mà SillyTavern bind trong initWorldInfo */
changeHandler = onWorldInfoChangeNative;

// Ghi lại số lần gọi của hàm căn chỉnh giao diện
let syncCalls = [];

// —— Bốn hàm giữ cho giống y hệt với bản implement đang được test ——

function isWorldEnabled(name) {
    return Array.isArray(selectedWorldInfo) && selectedWorldInfo.includes(name);
}

function syncWorldInfoSelect(name, on) {
    let hit = 0;
    for (const o of dropdownOptions) {
        if (o.text === name) { o.selected = on; hit++; }
    }
    syncCalls.push({ name, on, hit });
    return hit;
}

function triggerWorldInfoChange() {
    if (worldCatalog.length === 0) return false;
    changeTriggered++;
    changeHandler();
    return true;
}

function toggleWorld(name, forceOn) {
    if (!name) return false;

    const before = isWorldEnabled(name);
    const wantOn = (forceOn === undefined) ? !before : Boolean(forceOn);
    if (wantOn === before) return before;

    // 1. Đổi dữ liệu trực tiếp
    let changed = false;
    try {
        if (wantOn) {
            if (!selectedWorldInfo.includes(name)) { selectedWorldInfo.push(name); changed = true; }
        } else {
            let idx = selectedWorldInfo.indexOf(name);
            while (idx !== -1) { selectedWorldInfo.splice(idx, 1); changed = true; idx = selectedWorldInfo.indexOf(name); }
        }
    } catch { return before; }

    if (!changed) return isWorldEnabled(name);

    // 2. Mượn kênh SillyTavern để ghi ngược: Căn chỉnh dropdown trước, sau đó kích hoạt change
    let hit = 0;
    try {
        hit = syncWorldInfoSelect(name, wantOn);
        if (hit > 0) triggerWorldInfoChange();
    } catch { /* Ghi ngược thất bại cũng không ảnh hưởng đến kết quả của bước 1 */ }

    // 3. Dự phòng (fallback) lưu ổ đĩa + phát event (ở đây dùng saveCalls để đại diện)
    saveCalls++;

    return isWorldEnabled(name);
}

console.log('=== Tự kiểm tra logic công tắc kích hoạt ===\n');

// [1] Đọc trạng thái
console.log('[1] Đọc trạng thái kích hoạt');
rebuildDropdown();
if (isWorldEnabled('Worldbook A') === true) ok('Sách đã kích hoạt thì có thể đọc ra'); else no('Sách đã kích hoạt thì có thể đọc ra');
if (isWorldEnabled('Worldbook C') === false) ok('Sách chưa kích hoạt thì đọc ra false'); else no('Sách chưa kích hoạt thì đọc ra false');
if (isWorldEnabled('') === false) ok('Tên rỗng không báo lỗi, trả về false'); else no('Tên rỗng không báo lỗi');

// [2] Bật
console.log('\n[2] Bật một cuốn Worldbook chưa được bật');
selectedWorldInfo = ['Worldbook A', 'Worldbook B'];
rebuildDropdown();
const r1 = toggleWorld('Worldbook C');
if (r1 === true) ok('Giá trị trả về báo là đã bật'); else no('Giá trị trả về báo là đã bật', String(r1));
if (isWorldEnabled('Worldbook C')) ok('Đã thêm vào dữ liệu thật'); else no('Đã thêm vào dữ liệu thật');
if (selectedWorldInfo.filter(n => n === 'Worldbook C').length === 1) ok('Chỉ thêm đúng một bản, không bị trùng lặp');
else no('Chỉ thêm đúng một bản', String(selectedWorldInfo.filter(n => n === 'Worldbook C').length));

// [3] Tắt
console.log('\n[3] Tắt một cuốn Worldbook đang bật');
const r2 = toggleWorld('Worldbook A');
if (r2 === false) ok('Giá trị trả về báo là đã tắt'); else no('Giá trị trả về báo là đã tắt', String(r2));
if (!isWorldEnabled('Worldbook A')) ok('Đã gỡ ra khỏi dữ liệu thật'); else no('Đã gỡ ra khỏi dữ liệu thật');
if (isWorldEnabled('Worldbook B')) ok('Không làm ảnh hưởng nhầm đến Worldbook khác'); else no('Không làm ảnh hưởng nhầm đến Worldbook khác');

// [4] Khi trạng thái đã khớp thì không thao tác trùng lặp
console.log('\n[4] Khi đã ở đúng trạng thái mục tiêu thì không thao tác trùng lặp');
const lenBefore = selectedWorldInfo.length;
const trigBefore4 = changeTriggered;
toggleWorld('Worldbook B', true);   // B vốn dĩ đang bật
if (selectedWorldInfo.length === lenBefore) ok('Chiều dài danh sách không thay đổi');
else no('Chiều dài danh sách không thay đổi', `${lenBefore} -> ${selectedWorldInfo.length}`);
if (changeTriggered === trigBefore4) ok('Cũng không kích hoạt change dư thừa');
else no('Cũng không kích hoạt change dư thừa', `${trigBefore4} -> ${changeTriggered}`);

// [5] forceOn chỉ định tường minh
console.log('\n[5] Chỉ định tường minh trạng thái mục tiêu');
toggleWorld('Worldbook D', true);
if (isWorldEnabled('Worldbook D')) ok('forceOn=true có thể bật'); else no('forceOn=true có thể bật');
toggleWorld('Worldbook D', false);
if (!isWorldEnabled('Worldbook D')) ok('forceOn=false có thể tắt'); else no('forceOn=false có thể tắt');

// [6] Tên chứa dấu phẩy —— Bản mới không cắt nhỏ tên ra, nên vẫn có thể thay đổi bình thường
console.log('\n[6] Tên Worldbook có chứa dấu phẩy');
selectedWorldInfo = ['Sach,Co,Dau,Phay', 'Sach khac'];
rebuildDropdown();
const r6 = toggleWorld('Sach,Co,Dau,Phay');
if (r6 === false) ok('Sách chứa dấu phẩy được tắt chính xác'); else no('Sách chứa dấu phẩy được tắt chính xác', String(r6));
if (!isWorldEnabled('Sach,Co,Dau,Phay')) ok('Đã gỡ ra khỏi dữ liệu thật'); else no('Đã gỡ ra khỏi dữ liệu thật');
if (isWorldEnabled('Sach khac')) ok('Không vô tình gỡ luôn cả "Sach khac"'); else no('Không vô tình gỡ luôn cả "Sach khac"');

// [6b] Tên chứa dấu phẩy cũng có thể mở
console.log('\n[6b] Tên chứa dấu phẩy cũng có thể mở');
toggleWorld('Sach,Co,Dau,Phay', true);
if (isWorldEnabled('Sach,Co,Dau,Phay')) ok('Có thể mở lại'); else no('Có thể mở lại');

// [7] Khi mục tiêu không nằm trong dropdown, trả về đúng thực tế và **không kích hoạt change**
console.log('\n[7] Hành vi khi mục tiêu không nằm trong dropdown');
selectedWorldInfo = ['Sach giu nguyen'];
rebuildDropdown();
const trigBefore7 = changeTriggered;
const saveBefore7 = saveCalls;
const r7 = toggleWorld('Sach ma');   // Không có trong catalog
if (r7 === true) {
    ok('Cách implement đổi dữ liệu trực tiếp sẽ thêm nó vào (đúng như kỳ vọng)');
    if (isWorldEnabled('Sach ma')) ok('Thật sự đã thêm vào rồi'); else no('Thật sự đã thêm vào rồi');
} else {
    no('r7 nên là true', String(r7));
}
// ★ Mấu chốt: Trong dropdown không có nó -> Tuyệt đối không được kích hoạt change,
//   Nếu không SillyTavern sẽ ghi đè dữ liệu theo nội dung của dropdown, xóa luôn "Sach ma" đi mất.
if (changeTriggered === trigBefore7) ok('Trong dropdown không có sách này -> Không kích hoạt change (để tránh trạng thái bị xóa mất)');
else no('Trong dropdown không có sách này -> Không được kích hoạt change', `${trigBefore7} -> ${changeTriggered}`);
if (isWorldEnabled('Sach ma')) ok('Dữ liệu vẫn được giữ lại (không bị change ghi đè mất)');
else no('Dữ liệu vẫn được giữ lại', JSON.stringify(selectedWorldInfo));
if (saveCalls > saveBefore7) ok('Dự phòng lưu ổ đĩa vẫn diễn ra bình thường'); else no('Dự phòng lưu ổ đĩa vẫn diễn ra bình thường');
if (isWorldEnabled('Sach giu nguyen')) ok('Các Worldbook khác không bị động chạm đến'); else no('Các Worldbook khác không bị động chạm đến');

// [8] Tên rỗng
console.log('\n[8] Tên rỗng');
selectedWorldInfo = ['Worldbook A'];
rebuildDropdown();
if (toggleWorld('') === false) ok('Tên rỗng trực tiếp trả về false, không bị văng lỗi'); else no('Tên rỗng trực tiếp trả về false');

// [9] Mục trùng lặp có thể được dọn sạch
console.log('\n[9] Khi trong danh sách vô tình xuất hiện mục trùng lặp thì có thể dọn sạch');
selectedWorldInfo = ['Sach bi trung', 'Sach bi trung', 'Sach bi trung', 'Nguoi khac'];
rebuildDropdown();
toggleWorld('Sach bi trung', false);
if (!isWorldEnabled('Sach bi trung')) ok('Tất cả các mục trùng tên đều đã bị dọn đi');
else no('Tất cả các mục trùng tên đều đã bị dọn đi', JSON.stringify(selectedWorldInfo));
if (isWorldEnabled('Nguoi khac')) ok('Không làm ảnh hưởng nhầm'); else no('Không làm ảnh hưởng nhầm');

// [10] Hàm căn chỉnh giao diện được gọi
console.log('\n[10] Căn chỉnh giao diện');
syncCalls = [];
selectedWorldInfo = [];
rebuildDropdown();
toggleWorld('Worldbook A', true);
if (syncCalls.length === 1 && syncCalls[0].name === 'Worldbook A' && syncCalls[0].on === true && syncCalls[0].hit === 1) {
    ok('Hàm căn chỉnh được gọi chính xác, và thật sự đã sửa 1 option');
} else {
    no('Hàm căn chỉnh được gọi chính xác', JSON.stringify(syncCalls));
}

// [11] ★ Kênh ghi ngược thật sự đã đồng bộ thay đổi sang "phía SillyTavern"
console.log('\n[11] Mượn kênh change của SillyTavern để ghi ngược (bug được sửa ở bản 0.2.1)');
selectedWorldInfo = ['Worldbook A'];
rebuildDropdown();
globalSelectMirror = ['Worldbook A'];   // Giả vờ là SillyTavern vốn dĩ đã đồng bộ A sang rồi
changeTriggered = 0; saveCalls = 0;

toggleWorld('Worldbook C', true);

if (changeTriggered === 1) ok('Kích hoạt change đúng một lần'); else no('Kích hoạt change đúng một lần', String(changeTriggered));
if (isWorldEnabled('Worldbook C')) ok('Dữ liệu phía plugin cho là đã bật');
else no('Dữ liệu phía plugin cho là đã bật', JSON.stringify(selectedWorldInfo));
// ★ Assertion cốt lõi: Giao diện SillyTavern / lưu ổ đĩa đọc cái globalSelectMirror, nó cũng bắt buộc phải theo kịp
if (Array.isArray(globalSelectMirror) && globalSelectMirror.includes('Worldbook C')) {
    ok('★ Phía SillyTavern (globalSelect) cũng đã đồng bộ —— Giao diện sẽ thay đổi theo');
} else {
    no('★ Phía SillyTavern (globalSelect) cũng đã đồng bộ', JSON.stringify(globalSelectMirror));
}
if (globalSelectMirror && globalSelectMirror.includes('Worldbook A')) ok('Sách vốn đang mở vẫn được giữ lại bên phía SillyTavern');
else no('Sách vốn đang mở vẫn được giữ lại bên phía SillyTavern', JSON.stringify(globalSelectMirror));
if (dropdownOptions.find(o => o.text === 'Worldbook C')?.selected === true) ok('Dấu tick của C trong dropdown cũng đã đúng');
else no('Dấu tick của C trong dropdown cũng đã đúng');

// [11b] Khi đóng cũng có thể đồng bộ tương tự
console.log('\n[11b] Khi đóng cũng có thể đồng bộ sang phía SillyTavern');
toggleWorld('Worldbook C', false);
if (!isWorldEnabled('Worldbook C')) ok('Dữ liệu phía plugin cho là đã đóng');
else no('Dữ liệu phía plugin cho là đã đóng', JSON.stringify(selectedWorldInfo));
if (Array.isArray(globalSelectMirror) && !globalSelectMirror.includes('Worldbook C')) ok('★ Phía SillyTavern cũng đã hủy bỏ');
else no('★ Phía SillyTavern cũng đã hủy bỏ', JSON.stringify(globalSelectMirror));
if (dropdownOptions.find(o => o.text === 'Worldbook C')?.selected === false) ok('Dấu tick của C trong dropdown cũng đã bị hủy');
else no('Dấu tick của C trong dropdown cũng đã bị hủy');

// [11c] ★ Khi trong dropdown không có cuốn sách này, phía SillyTavern tuyệt đối không được bị "tiện tay xóa trắng"
console.log('\n[11c] Khi dropdown không có sách này, phía SillyTavern không được bị xóa trắng');
selectedWorldInfo = ['Worldbook A'];
rebuildDropdown();
globalSelectMirror = ['Worldbook A'];
toggleWorld('Sach ma 2', true);
if (Array.isArray(globalSelectMirror) && globalSelectMirror.includes('Worldbook A')) {
    ok('★ A vốn có bên phía SillyTavern không bị xóa trắng');
} else {
    no('★ A vốn có bên phía SillyTavern không bị xóa trắng', JSON.stringify(globalSelectMirror));
}
// Dọn dẹp
selectedWorldInfo = selectedWorldInfo.filter(n => n !== 'Sach ma 2');
rebuildDropdown();
globalSelectMirror = selectedWorldInfo.slice();

// [12] ★ Khi danh sách chưa sẵn sàng, khởi động (warm-up) trước rồi mới sửa
console.log('\n[12] Khởi động khi danh sách Worldbook chưa sẵn sàng');
let ensureCalls = 0;
let listReady = false;

async function ensureWorldListReadyStub() {
    ensureCalls++;
    if (!listReady) {
        listReady = true;
        rebuildDropdown();   // Tương đương với updateWorldInfoList lấp đầy dropdown
    }
}

async function toggleWorldAsync(name, forceOn) {
    if (!name) return false;
    const before = isWorldEnabled(name);
    const wantOn = (forceOn === undefined) ? !before : Boolean(forceOn);
    if (wantOn === before) return before;

    await ensureWorldListReadyStub();

    let changed = false;
    if (wantOn) {
        if (!selectedWorldInfo.includes(name)) { selectedWorldInfo.push(name); changed = true; }
    } else {
        let idx = selectedWorldInfo.indexOf(name);
        while (idx !== -1) { selectedWorldInfo.splice(idx, 1); changed = true; idx = selectedWorldInfo.indexOf(name); }
    }
    if (!changed) return isWorldEnabled(name);

    const hit = syncWorldInfoSelect(name, wantOn);
    if (hit > 0) triggerWorldInfoChange();
    saveCalls++;
    return isWorldEnabled(name);
}

// Mô phỏng "Người dùng chưa từng mở bảng Worldbook bao giờ": dropdown trống trơn
selectedWorldInfo = [];
dropdownOptions = [];          // Dropdown trống
worldCatalog.length = 0;       // Ngay cả danh sách tên cũng không có
globalSelectMirror = [];
ensureCalls = 0; changeTriggered = 0;

// Khôi phục lại catalog trước (trong thế giới thực /api/worldinfo/list vốn dĩ có thể trả về)
worldCatalog.push('Worldbook A', 'Worldbook B', 'Worldbook C', 'Worldbook D', 'Sach,Co,Dau,Phay', 'Sach khac', 'Sach giu nguyen', 'Sach bi trung', 'Nguoi khac');

const r12 = await toggleWorldAsync('Worldbook C', true);
if (ensureCalls === 1) ok('Đã gọi khởi động một lần trước (làm mới danh sách Worldbook)');
else no('Đã gọi khởi động một lần trước', String(ensureCalls));
if (r12 === true) ok('Sau khi khởi động thì công tắc vẫn thành công như thường');
else no('Sau khi khởi động thì công tắc vẫn thành công như thường', String(r12));
if (isWorldEnabled('Worldbook C')) ok('Dữ liệu đã đổi được');
else no('Dữ liệu đã đổi được', JSON.stringify(selectedWorldInfo));
if (Array.isArray(globalSelectMirror) && globalSelectMirror.includes('Worldbook C')) {
    ok('★ Phía SillyTavern cũng đã đồng bộ (cho dù ban đầu dropdown trống trơn)');
} else {
    no('★ Phía SillyTavern cũng đã đồng bộ', JSON.stringify(globalSelectMirror));
}

// [13] Chuyển đổi qua lại nhiều lần trạng thái vẫn tự nhất quán
console.log('\n[13] Trạng thái tự nhất quán sau khi chuyển đổi qua lại nhiều lần');
selectedWorldInfo = [];
rebuildDropdown();
globalSelectMirror = [];
worldCatalog.length = 0;
worldCatalog.push('Worldbook A', 'Worldbook B', 'Worldbook C', 'Worldbook D', 'Sach,Co,Dau,Phay', 'Sach khac', 'Sach giu nguyen', 'Sach bi trung', 'Nguoi khac');
rebuildDropdown();

for (let i = 0; i < 5; i++) {
    await toggleWorldAsync('Worldbook B', true);
    await toggleWorldAsync('Worldbook B', false);
}
await toggleWorldAsync('Worldbook B', true);
if (selectedWorldInfo.filter(n => n === 'Worldbook B').length === 1) ok('Không sinh ra mục trùng lặp sau khi chuyển đổi qua lại nhiều lần');
else no('Không sinh ra mục trùng lặp sau khi chuyển đổi qua lại nhiều lần', JSON.stringify(selectedWorldInfo));
if (isWorldEnabled('Worldbook B')) ok('Trạng thái cuối cùng chính xác (đang mở)'); else no('Trạng thái cuối cùng chính xác (đang mở)');
if (selectedWorldInfo.length === 1) ok('Trong danh sách chỉ có duy nhất cuốn này');
else no('Trong danh sách chỉ có duy nhất cuốn này', JSON.stringify(selectedWorldInfo));

console.log(`\n=== Kết quả: ${pass} mục pass, ${fail} mục fail ===`);
process.exit(fail ? 1 : 0);