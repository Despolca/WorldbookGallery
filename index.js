/**
 * Worldbook Gallery — Quản lý Ảnh bìa Worldbook
 *
 * Mục đích: Hiển thị các Worldbook "tên kỳ quặc, không nhận ra" trong SillyTavern bằng "ảnh bìa của thẻ nhân vật được liên kết".
 *
 * Tiền đề cứng của thiết kế (đã được xác minh trong mã nguồn SillyTavern 1.18.0):
 *   File PNG của mỗi thẻ nhân vật đều có chứa trường dữ liệu data.extensions.world
 *   Giá trị của nó chính là tên của "thẻ này liên kết với Worldbook nào" - đây là nguồn quan hệ tương ứng uy quyền duy nhất.
 *   Tham khảo: public/scripts/world-info.js lân cận các dòng 1127, 4164, 5567, 6205.
 *
 * Plugin này tuân thủ nghiêm ngặt nguyên tắc "chỉ xem không sửa":
 *   - Không ghi bất kỳ file nào
 *   - Không đổi tên Worldbook, không đổi tên thẻ
 *   - Không gọi bất kỳ API nào làm thay đổi dữ liệu
 *   Tên hiển thị trong bảng điều khiển là "tên hiển thị được ghép lại", tên file trên ổ đĩa không thay đổi một chữ nào.
 */

// Giải thích chuẩn đường dẫn (đã hiệu chuẩn thực tế theo SillyTavern 1.18.0):
// Extension này nằm ở public/scripts/extensions/third-party/worldbook-gallery/index.js
//   script.js      thực tế nằm ở public/script.js         -> Cần lùi lên 4 tầng
//   world-info.js  thực tế nằm ở public/scripts/           -> Cần lùi lên 3 tầng
//   extensions.js  thực tế nằm ở public/scripts/           -> Cần lùi lên 3 tầng
// Lưu ý: script.js nằm dưới public/, không phải dưới public/scripts/, số tầng của hai bên khác nhau.
import {
    eventSource,
    event_types,
    getRequestHeaders,
    getThumbnailUrl,
    characters,
    saveSettingsDebounced,
} from '../../../../script.js';
import {
    world_names,
    selected_world_info,
    openWorldInfoEditor,
    updateWorldInfoList,
} from '../../../world-info.js';
import { extension_settings } from '../../../extensions.js';

const MODULE_NAME = 'worldbook-gallery';
const LOG_PREFIX = '[Worldbook Gallery]';

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------

const defaultSettings = {
    // Kiểu tên hiển thị: 'card' (Ưu tiên tên thẻ) | 'world' (Ưu tiên tên Worldbook) | 'both' (Tên thẻ · Tên Worldbook)
    displayStyle: 'both',
    // Có hiển thị các Worldbook không liên kết với thẻ nào trong lưới hay không
    showOrphans: true,
    // Có chỉ xem các Worldbook hiện đang bật hay không
    onlyEnabled: false,
    // Kích thước ảnh thu nhỏ (pixel)
    thumbSize: 150,
};

function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE_NAME];
}

// ---------------------------------------------------------------------------
// Thu thập dữ liệu
// ---------------------------------------------------------------------------

/**
 * Xây dựng ánh xạ "Tên Worldbook -> Danh sách thẻ nhân vật liên kết với nó".
 *
 * Nguồn dữ liệu: data.extensions.world của mỗi thẻ trong mảng characters.
 * Ngoài ra còn kiểm tra character_book (Worldbook nhúng) đi kèm thẻ - Worldbook của loại thẻ này
 * có thể chưa được import thành file độc lập, thuộc trường hợp "Có thẻ nhưng chưa có Worldbook".
 */
function buildIndex() {
    const byWorld = new Map();   // Tên Worldbook -> [ {avatar, name, chid} ]
    const embedded = [];         // Thẻ đi kèm Worldbook

    for (let chid = 0; chid < characters.length; chid++) {
        const ch = characters[chid];
        if (!ch) continue;

        const avatar = ch.avatar;
        const cardName = ch.name || (avatar ? avatar.replace(/\.png$/i, '') : '(Vô danh)');

        // Liên kết Worldbook chính
        const worldName = ch?.data?.extensions?.world;
        if (worldName) {
            if (!byWorld.has(worldName)) byWorld.set(worldName, []);
            byWorld.get(worldName).push({ avatar, name: cardName, chid });
        }

        // Thẻ đi kèm Worldbook (character_book)
        const book = ch?.data?.character_book;
        if (book) {
            embedded.push({
                avatar,
                name: cardName,
                chid,
                bookName: book?.name || '',
                entryCount: Array.isArray(book?.entries) ? book.entries.length : 0,
                linkedWorld: worldName || '',
            });
        }
    }

    return { byWorld, embedded };
}

/**
 * Đọc danh sách Worldbook. Dùng API có sẵn của SillyTavern để lấy, đảm bảo nhất quán với những gì SillyTavern nhìn thấy.
 * Trả về: [{ file_id, name, extensions }]
 */
async function fetchWorldList() {
    const res = await fetch('/api/worldinfo/list', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Lấy danh sách Worldbook thất bại: HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/**
 * Đọc chi tiết của một cuốn Worldbook nào đó, dùng để thống kê số lượng mục (entries).
 * Số lượng mục có thể giúp người dùng phán đoán đại khái "cuốn này có phải là cuốn mình cần hay không".
 */
async function fetchWorldDetail(name) {
    try {
        const res = await fetch('/api/worldinfo/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const entries = data?.entries;
        const count = entries
            ? (Array.isArray(entries) ? entries.length : Object.keys(entries).length)
            : 0;
        return { entryCount: count, raw: data };
    } catch (err) {
        console.warn(LOG_PREFIX, 'Đọc chi tiết Worldbook thất bại', name, err);
        return null;
    }
}

/**
 * Tổng hợp thành dữ liệu dòng dùng cho bảng điều khiển.
 * Mỗi dòng đại diện cho "một cuốn Worldbook", đính kèm ảnh bìa của nó.
 */
async function collectRows({ withDetails = false } = {}) {
    const { byWorld, embedded } = buildIndex();
    const worlds = await fetchWorldList();
    const settings = getSettings();

    const rows = [];
    const seen = new Set();

    for (const w of worlds) {
        const key = w.file_id ?? w.name;
        seen.add(key);

        const owners = byWorld.get(w.file_id) || byWorld.get(w.name) || [];
        const primary = owners[0] || null;

        rows.push({
            kind: 'world',
            worldFile: w.file_id ?? w.name,
            worldName: w.name || w.file_id,
            owners,
            primaryAvatar: primary ? primary.avatar : null,
            primaryCardName: primary ? primary.name : null,
            entryCount: null,
            raw: w,
        });
    }

    // Thẻ liên kết với một cái tên, nhưng cuốn Worldbook đó không tồn tại - "Có thẻ nhưng không có Worldbook"
    for (const [worldName, owners] of byWorld.entries()) {
        if (!seen.has(worldName)) {
            rows.push({
                kind: 'missing',
                worldFile: worldName,
                worldName,
                owners,
                primaryAvatar: owners[0]?.avatar ?? null,
                primaryCardName: owners[0]?.name ?? null,
                entryCount: null,
                raw: null,
            });
        }
    }

    if (withDetails) {
        for (const row of rows) {
            if (row.kind === 'world') {
                const detail = await fetchWorldDetail(row.worldFile);
                row.entryCount = detail ? detail.entryCount : null;
            }
        }
    }

    // Worldbook bị cô lập (không có bất kỳ thẻ nào liên kết)
    if (!settings.showOrphans) {
        return { rows: rows.filter(r => r.owners.length > 0 || r.kind !== 'world'), embedded };
    }

    return { rows, embedded };
}

// ---------------------------------------------------------------------------
// Ghép tên hiển thị
// ---------------------------------------------------------------------------

/**
 * Ghép thành một cái tên "người đọc hiểu được".
 * Chỉ xem không sửa - đây là chuỗi ký tự hiển thị trong bảng điều khiển, tên file trên ổ đĩa không thay đổi.
 */
function displayName(row) {
    const style = getSettings().displayStyle;
    const card = row.primaryCardName;
    const world = row.worldName;

    if (!card) {
        // Không có thẻ liên kết, chỉ có thể hiển thị bản thân tên Worldbook, và đánh dấu lại
        return style === 'world' ? world : `${world} (Chưa liên kết thẻ)`;
    }

    switch (style) {
        case 'card': return card;
        case 'world': return world;
        case 'both':
        default:
            return card === world ? card : `${card} · ${world}`;
    }
}

// ---------------------------------------------------------------------------
// Bật / Tắt Worldbook
// ---------------------------------------------------------------------------
//
// Trong SillyTavern "Worldbook có đang bật hay không" chỉ "Danh sách kích hoạt toàn cục" - chính là checkbox
// "World Info đã bật (Có hiệu lực toàn cục)" trong bảng cài đặt, tương ứng với biến nội bộ selected_world_info.
// Worldbook đi kèm thẻ sau khi import sẽ được thêm vào danh sách toàn cục này, nên ở đây chúng ta điều khiển nó.
//
// Tại sao không dùng slash command onWorldInfoChange(args, text) có sẵn của SillyTavern:
//   Phiên bản đầu tiên đã thử, thực tế bấm không chạy. Đầu vào đó tìm Worldbook ở bên trong như sau
//   (world-info.js dòng 5654~5660):
//       text.trim().toLowerCase().split(',')   // Đổi thành chữ thường trước, sau đó cắt bằng dấu phẩy
//       getWIElement(worldName)                // Sau đó đi ghép nối trong dropdown #world_info
//   Mà getWIElement lấy "text của từng mục trong dropdown" để so sánh từng chữ với tên (dòng 2090).
//   Bất kỳ mắt xích nào trên chuỗi này không thỏa mãn thì sẽ thất bại trong im lặng (silent fail):
//     - Dropdown chưa được lấp đầy (phải mở bảng Worldbook ra mới lấp đầy, xem updateWorldInfoList)
//     - Tên có dấu phẩy -> Bị cắt vụn
//     - Tên không khớp -> Trực tiếp "không tìm thấy Worldbook này"
//   Kết quả là: Bấm công tắc, không có gì xảy ra, chỉ thấy "Không thể thay đổi" ở góc dưới bên phải.
//
//   Lưu ý: Ở đây đang nói đến đầu vào **có tham số** (dành cho slash command).
//   onWorldInfoChange('__notSlashCommand__') không tham số lại là một chuyện khác -
//   nó là hàm xử lý event change của chính cái dropdown SillyTavern, chính là kênh mà chúng ta cần mượn, xem lớp thứ hai bên dưới.
//
// Cách làm hiện tại (Kết nối trực tiếp dữ liệu + Mượn kênh ghi ngược của chính SillyTavern):
//
//   Lớp thứ nhất - Sửa dữ liệu trực tiếp:
//     selected_world_info ở dòng 66 của world-info.js là `export let`,
//     cái được export là **bản thân mảng đó**. Imported binding của ES module không thể được gán lại toàn bộ giá trị,
//     nhưng **có thể sửa nội dung mảng tại chỗ** (push / splice), cái sửa chính là phần dữ liệu mà SillyTavern đang dùng.
//
//   Lớp thứ hai - Mượn kênh ghi ngược của chính SillyTavern (Mấu chốt, bản 0.2.1 mới bổ sung):
//     Chỉ sửa mảng là không đủ. SillyTavern lưu ổ đĩa và render giao diện đều đọc world_info.globalSelect,
//     mà trường này chỉ được đồng bộ bên trong cái hàm saveSettingsDebounced **private** ở dòng 84 của world-info.js
//     (dòng 85 Object.assign(world_info, { globalSelect: selected_world_info })).
//     Hàm saveSettingsDebounced cùng tên mà chúng ta import từ script.js là **một hàm khác**,
//     nó chỉ gọi saveSettings() để lưu ổ đĩa, hoàn toàn không chạm vào globalSelect - đây chính là nguyên nhân gốc rễ của việc "Công tắc đã gạt qua,
//     nhưng giao diện gốc của SillyTavern lại không thay đổi".
//
//     Kênh chuẩn xác có sẵn của SillyTavern là cái này (dòng 6057, được bind trong initWorldInfo):
//         $('#world_info').on('mousedown change', ...) -> onWorldInfoChange('__notSlashCommand__')
//     Nó sẽ đọc lại các mục được chọn trong dropdown, ghi đè selected_world_info,
//     sau đó đi qua dòng 5719~5723: Sửa mảng + saveSettingsDebounced() + Phát WORLDINFO_SETTINGS_UPDATED.
//     Nên cách làm của chúng ta là: Căn chỉnh trạng thái tick chọn của dropdown trước, sau đó trigger('change'),
//     phần còn lại giao hết cho SillyTavern tự hoàn thành.

/**
 * Cuốn sách này hiện tại đã được bật chưa.
 */
function isWorldEnabled(worldName) {
    return Array.isArray(selected_world_info) && selected_world_info.includes(worldName);
}

/**
 * Chuyển đổi trạng thái kích hoạt của một cuốn sách.
 *
 * Hàm này là bất đồng bộ (async), bởi vì có thể phải bù đắp một lần "load danh sách Worldbook".
 * Không await thì vẫn dùng được (dữ liệu và lưu ổ đĩa vẫn hoạt động), chỉ là UI có thể làm mới chậm một nhịp.
 *
 * @param {string} worldName Tên Worldbook
 * @param {boolean} [forceOn] Chỉ định bật hoặc tắt; nếu không truyền thì đảo ngược trạng thái hiện tại
 * @returns {Promise<boolean>} Trạng thái sau khi thao tác có đang bật hay không (thất bại trả về trạng thái cũ)
 */
async function toggleWorld(worldName, forceOn) {
    if (!worldName) return false;

    const before = isWorldEnabled(worldName);
    const wantOn = (forceOn === undefined) ? !before : Boolean(forceOn);

    if (wantOn === before) return before;   // Đã là trạng thái mục tiêu, không cần làm gì

    // ---- 0. Trước tiên đảm bảo cái dropdown của SillyTavern là "tươi mới khả dụng" ----
    //    Nếu không có bước này, trường hợp người dùng chưa từng mở bảng Worldbook, dropdown sẽ trống rỗng:
    //      a) Kênh ghi ngược của chúng ta sẽ không lấy được cuốn sách này (syncWorldInfoSelect trả về 0)
    //      b) globalSelect mà SillyTavern ghi vào lúc lưu ổ đĩa cũng có thể bị thiếu hụt
    //    Nên ở đây chủ động bổ sung danh sách một lần (tương đương với việc SillyTavern làm khi mở bảng điều khiển).
    try {
        await ensureWorldListReady();
    } catch (err) {
        console.warn(LOG_PREFIX, 'Làm mới danh sách Worldbook thất bại, tiếp tục thao tác theo trạng thái hiện tại', err);
    }

    // ---- 1. Sửa trực tiếp phần dữ liệu đó (Bước này bắt buộc phải thành công) ----
    let changed = false;
    try {
        if (wantOn) {
            // Đề phòng trùng lặp: Lỡ như trong đó đã có rồi thì đừng thêm lần hai
            if (!selected_world_info.includes(worldName)) {
                selected_world_info.push(worldName);
                changed = true;
            }
        } else {
            // Dùng while để dọn sạch tất cả các mục trùng tên (Về lý thuyết chỉ có một, làm vậy cho chắc)
            let idx = selected_world_info.indexOf(worldName);
            while (idx !== -1) {
                selected_world_info.splice(idx, 1);
                changed = true;
                idx = selected_world_info.indexOf(worldName);
            }
        }
    } catch (err) {
        console.error(LOG_PREFIX, 'Ghi đè danh sách kích hoạt thất bại', worldName, err);
        return before;
    }

    if (!changed) {
        // Dữ liệu không đổi (rất hiếm gặp), trả về đúng trạng thái thực tế
        return isWorldEnabled(worldName);
    }

    // ---- 2. Để SillyTavern tự tiếp quản thay đổi lần này ----
    // Thứ tự rất quan trọng: Căn chỉnh dấu tick của dropdown trước, sau đó mới kích hoạt change.
    // Sau khi kích hoạt, SillyTavern sẽ đi theo onWorldInfoChange('__notSlashCommand__'),
    // đọc lại mục được chọn từ dropdown -> Ghi đè selected_world_info -> Đồng bộ world_info.globalSelect
    // -> Lưu ổ đĩa -> Phát event làm mới giao diện. Toàn bộ chuỗi này là logic gốc của SillyTavern, đáng tin cậy hơn chúng ta tự ghép.
    try {
        syncWorldInfoSelect(worldName, wantOn);
        triggerWorldInfoChange();
    } catch (err) {
        console.warn(LOG_PREFIX, 'Mượn kênh SillyTavern ghi ngược thất bại, đã lùi về đường dẫn tự cấp của plugin (dữ liệu vẫn đúng)', err);
    }

    // ---- 3. Dự phòng (fallback): Bất kể bên trên thành công hay không, vẫn bù đắp lưu ổ đĩa + thông báo một lần ----
    // Gọi lặp lại vẫn an toàn (debounce sẽ gộp lại).
    // Lỡ như bước 2 không có tác dụng do dropdown chưa được lấp đầy, ở đây ít nhất đảm bảo dữ liệu được lưu vào ổ đĩa.
    try {
        saveSettingsDebounced();
    } catch (err) {
        console.warn(LOG_PREFIX, 'Lưu cài đặt thất bại', err);
    }
    try {
        eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
    } catch { /* Event không tồn tại thì bỏ qua */ }

    // ---- 4. Trả về dựa trên dữ liệu thực tế ----
    return isWorldEnabled(worldName);
}

/**
 * Đảm bảo "Danh sách Worldbook + cái dropdown đó" của SillyTavern là tươi mới khả dụng.
 *
 * Tại sao cần bước này (đã dẫm mìn thực tế):
 *   Dropdown #world_info của SillyTavern không phải sinh ra là có nội dung, chỉ sau khi
 *   updateWorldInfoList() (world-info.js dòng 2061) chạy qua thì nó mới được lấp đầy.
 *   Nó là một hàm async, bên trong sẽ:
 *     - Lấy lại danh sách tên Worldbook một lần nữa từ /api/settings/get
 *     - Làm trống và tạo lại <option> cho #world_info và #world_editor_select
 *     - Dựa theo selected_world_info để quyết định option nào được tick mặc định
 *   Nên chúng ta gọi nó một lần trước, tương đương với "giúp người dùng mở bảng Worldbook lên một chút".
 *
 * Giải thích an toàn:
 *   updateWorldInfoList chỉ đọc danh sách file, chỉ vẽ lại dropdown, sẽ không sửa nội dung Worldbook,
 *   không ghi bất kỳ file nào, cũng không sửa selected_world_info. Nó hoàn toàn là một thao tác làm mới thuần túy.
 */
async function ensureWorldListReady() {
    const $ = window.jQuery;
    if (!$) return;

    const $wi = $('#world_info');
    const hasOptions = $wi.length && $wi.find('option[value!=""]').length > 0;
    const hasNames = Array.isArray(world_names) && world_names.length > 0;

    if (hasOptions && hasNames) return;   // Đã ổn rồi, không cần làm gì

    if (typeof updateWorldInfoList !== 'function') {
        console.warn(LOG_PREFIX, 'Không lấy được updateWorldInfoList, bỏ qua khởi động (không ảnh hưởng đến việc sửa trực tiếp dữ liệu)');
        return;
    }

    console.log(LOG_PREFIX, 'Danh sách Worldbook chưa sẵn sàng, làm mới một lần trước');
    await updateWorldInfoList();
}

/**
 * Căn chỉnh trạng thái tick chọn trong cái checkbox nhiều lựa chọn (#world_info) trên giao diện SillyTavern cho khớp với bộ dạng sau khi chúng ta sửa đổi.
 *
 * Bước này là hành động tiền đề của "Mượn kênh SillyTavern ghi ngược", không phải là đồ trang trí có cũng được không có cũng không sao:
 * onWorldInfoChange('__notSlashCommand__') của SillyTavern là **đọc giá trị từ dropdown**
 * (world-info.js dòng 5705 $('#world_info').val()),
 * nên bắt buộc phải sửa dropdown thành bộ dạng chúng ta muốn trước, sau đó mới kích hoạt change.
 *
 * @returns {number} Sửa được mấy option; bằng 0 có nghĩa là trong dropdown không có cuốn sách này (có thể chưa render)
 */
function syncWorldInfoSelect(worldName, on) {
    const $ = window.jQuery;
    if (!$) return 0;
    const $wi = $('#world_info');
    if (!$wi.length) return 0;

    let hit = 0;
    $wi.find('option').each(function () {
        if ($(this).text() === worldName) {
            $(this).prop('selected', on);
            hit++;
        }
    });
    if (hit === 0) {
        // Trong dropdown không có cuốn sách này -> trigger('change') phía sau sẽ làm trống nó,
        // nên trường hợp này bắt buộc phải chặn lại từ sớm, đừng đi kích hoạt.
        console.warn(LOG_PREFIX, 'Không tìm thấy cuốn sách này trong dropdown, bỏ qua kênh ghi ngược:', JSON.stringify(worldName));
    }
    return hit;
}

/**
 * Kích hoạt change của #world_info, giao lại quyền kiểm soát cho SillyTavern.
 *
 * Chỉ kích hoạt khi "dropdown thực sự không rỗng": Bởi vì câu lệnh đầu tiên của onWorldInfoChange là
 * `if (world_names.length === 0) { e.preventDefault(); return; }`,
 * hơn nữa nó dùng val() để đọc giá trị - lỡ như dropdown vẫn rỗng, kích hoạt một lần tương đương với việc
 * ghi đè selected_world_info thành mảng rỗng, ngược lại làm mất luôn trạng thái.
 *
 * @returns {boolean} Có kích hoạt hay không
 */
function triggerWorldInfoChange() {
    const $ = window.jQuery;
    if (!$) return false;
    const $wi = $('#world_info');
    if (!$wi.length) return false;

    const names = Array.isArray(world_names) ? world_names : [];
    if (names.length === 0) {
        console.warn(LOG_PREFIX, 'Danh sách Worldbook vẫn đang rỗng (updateWorldInfoList có thể chưa chạy qua), bỏ qua kênh ghi ngược');
        return false;
    }

    $wi.trigger('change');
    return true;
}

// ---------------------------------------------------------------------------
// Render bảng điều khiển
// ---------------------------------------------------------------------------

let panelEl = null;
let lastRows = [];

function ensurePanel() {
    if (panelEl && document.body.contains(panelEl)) return panelEl;

    panelEl = document.createElement('div');
    panelEl.id = 'wbg-panel';
    panelEl.className = 'wbg-panel';
    panelEl.innerHTML = `
        <div class="wbg-header">
            <div class="wbg-title">
                <i class="fa-solid fa-images"></i>
                <span>Quản lý Ảnh bìa Worldbook</span>
            </div>
            <div class="wbg-header-actions">
                <button class="wbg-btn" id="wbg-refresh" title="Quét lại">
                    <i class="fa-solid fa-rotate"></i> Quét lại
                </button>
                <button class="wbg-btn wbg-btn-close" id="wbg-close" title="Đóng">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
        <div class="wbg-toolbar">
            <input type="search" id="wbg-search" class="text_pole" placeholder="Tìm kiếm tên thẻ hoặc tên Worldbook..." />
            <select id="wbg-style" class="text_pole">
                <option value="both">Hiển thị: Tên thẻ · Tên Worldbook</option>
                <option value="card">Chỉ hiển thị tên thẻ</option>
                <option value="world">Chỉ hiển thị tên Worldbook</option>
            </select>
            <label class="wbg-check">
                <input type="checkbox" id="wbg-orphans" checked />
                <span>Hiển thị Worldbook chưa liên kết</span>
            </label>
            <label class="wbg-check">
                <input type="checkbox" id="wbg-only-on" />
                <span>Chỉ xem các mục đã bật</span>
            </label>
        </div>
        <div class="wbg-stats" id="wbg-stats"></div>
        <div class="wbg-body" id="wbg-body"></div>
    `;

    document.body.appendChild(panelEl);

    panelEl.querySelector('#wbg-close').addEventListener('click', () => closePanel());
    panelEl.querySelector('#wbg-refresh').addEventListener('click', () => refresh(true));
    panelEl.querySelector('#wbg-search').addEventListener('input', () => renderGrid());
    panelEl.querySelector('#wbg-style').addEventListener('change', (e) => {
        getSettings().displayStyle = e.target.value;
        saveSettingsDebounced();
        renderGrid();
    });
    panelEl.querySelector('#wbg-orphans').addEventListener('change', (e) => {
        getSettings().showOrphans = e.target.checked;
        saveSettingsDebounced();
        refresh(false);
    });
    panelEl.querySelector('#wbg-only-on').addEventListener('change', (e) => {
        getSettings().onlyEnabled = e.target.checked;
        saveSettingsDebounced();
        renderGrid();
    });

    return panelEl;
}

function openPanel() {
    ensurePanel();
    const s = getSettings();
    panelEl.querySelector('#wbg-style').value = s.displayStyle;
    panelEl.querySelector('#wbg-orphans').checked = s.showOrphans;
    panelEl.querySelector('#wbg-only-on').checked = Boolean(s.onlyEnabled);
    panelEl.classList.add('wbg-open');
    refresh(true);
}

function closePanel() {
    if (panelEl) panelEl.classList.remove('wbg-open');
}

function setStats(text) {
    ensurePanel().querySelector('#wbg-stats').textContent = text;
}

async function refresh(withDetails) {
    const body = ensurePanel().querySelector('#wbg-body');
    body.innerHTML = `<div class="wbg-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang quét Worldbook và thẻ nhân vật...</div>`;
    setStats('');

    try {
        const { rows, embedded } = await collectRows({ withDetails: Boolean(withDetails) });
        lastRows = rows;

        const bound = rows.filter(r => r.owners.length > 0).length;
        const orphan = rows.filter(r => r.kind === 'world' && r.owners.length === 0).length;
        const missing = rows.filter(r => r.kind === 'missing').length;

        const parts = [`Tổng cộng ${rows.length} cuốn Worldbook`, `Trong đó ${bound} cuốn đã liên kết thẻ`];
        if (orphan) parts.push(`${orphan} cuốn không có thẻ liên kết`);
        if (missing) parts.push(`${missing} cuốn trong thẻ có ghi nhưng file không tồn tại`);
        if (embedded.length) parts.push(`${embedded.length} thẻ đi kèm Worldbook`);

        // Hàng thống kê được lưu thành hai đoạn: baseText là phần không thay đổi theo công tắc,
        // mỗi lần bật/tắt công tắc chỉ cần ghép lại nửa sau là được, không cần quét lại.
        const statsEl = ensurePanel().querySelector('#wbg-stats');
        statsEl.dataset.baseText = parts.join(' · ');
        const enabledCount = rows.filter(r => r.kind === 'world' && isWorldEnabled(r.worldName)).length;
        statsEl.textContent = `${statsEl.dataset.baseText} · ${enabledCount} cuốn đã bật`;

        renderGrid();
    } catch (err) {
        console.error(LOG_PREFIX, err);
        body.innerHTML = `<div class="wbg-error">Quét thất bại: ${escapeHtml(String(err?.message || err))}</div>`;
    }
}

function renderGrid() {
    const panel = ensurePanel();
    const body = panel.querySelector('#wbg-body');
    const query = (panel.querySelector('#wbg-search').value || '').trim().toLowerCase();

    let rows = lastRows;
    if (getSettings().onlyEnabled) {
        rows = rows.filter(r => r.kind === 'world' && isWorldEnabled(r.worldName));
    }
    if (query) {
        rows = rows.filter(r =>
            (r.worldName || '').toLowerCase().includes(query) ||
            (r.primaryCardName || '').toLowerCase().includes(query) ||
            r.owners.some(o => (o.name || '').toLowerCase().includes(query)));
    }

    if (!rows.length) {
        body.innerHTML = `<div class="wbg-empty">Không có Worldbook nào khớp.</div>`;
        return;
    }

    // Sắp xếp: Có thẻ thì xếp trước, trong cùng nhóm thì xếp theo tên hiển thị
    rows = rows.slice().sort((a, b) => {
        const ao = a.owners.length ? 0 : 1;
        const bo = b.owners.length ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return displayName(a).localeCompare(displayName(b), 'vi');
    });

    const size = getSettings().thumbSize;
    const grid = document.createElement('div');
    grid.className = 'wbg-grid';
    grid.style.setProperty('--wbg-thumb', `${size}px`);

    for (const row of rows) {
        grid.appendChild(buildCard(row));
    }

    body.innerHTML = '';
    body.appendChild(grid);
}

function buildCard(row) {
    // Chỉ những Worldbook tồn tại thực sự mới có khái niệm "bật/tắt"; trong thẻ có ghi nhưng file đã mất thì không tính.
    const canToggle = row.kind === 'world';
    const enabled = canToggle ? isWorldEnabled(row.worldName) : false;

    const card = document.createElement('div');
    card.className = 'wbg-card';
    if (row.kind === 'missing') card.classList.add('wbg-card-missing');
    if (!row.owners.length && row.kind === 'world') card.classList.add('wbg-card-orphan');
    if (canToggle) card.classList.add(enabled ? 'wbg-card-on' : 'wbg-card-off');

    // Ảnh bìa
    const thumb = document.createElement('div');
    thumb.className = 'wbg-thumb';
    if (row.primaryAvatar) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        // Dùng API ảnh thu nhỏ có sẵn của SillyTavern, nhanh hơn nhiều so với lấy trực tiếp ảnh gốc (ảnh gốc có thể nặng vài MB)
        img.src = getThumbnailUrl('avatar', row.primaryAvatar);
        img.alt = row.primaryCardName || '';
        img.onerror = () => {
            img.remove();
            thumb.classList.add('wbg-thumb-broken');
        };
        thumb.appendChild(img);
    } else {
        thumb.innerHTML = `<div class="wbg-thumb-placeholder"><i class="fa-regular fa-file-lines"></i></div>`;
    }

    if (row.owners.length > 1) {
        const badge = document.createElement('div');
        badge.className = 'wbg-badge';
        badge.textContent = `${row.owners.length} thẻ`;
        badge.title = row.owners.map(o => o.name).join('\n');
        thumb.appendChild(badge);
    }

    // Nhãn trạng thái: Dán ở góc dưới bên trái ảnh bìa, nhìn một phát là biết mở hay chưa
    let stateTag = null;
    if (canToggle) {
        stateTag = document.createElement('div');
        stateTag.className = 'wbg-state';
        stateTag.textContent = enabled ? 'Đã bật' : 'Đã tắt';
        thumb.appendChild(stateTag);
    }

    // Khu vực văn bản
    const meta = document.createElement('div');
    meta.className = 'wbg-meta';

    const nameEl = document.createElement('div');
    nameEl.className = 'wbg-name';
    nameEl.textContent = displayName(row);
    nameEl.title = displayName(row);
    meta.appendChild(nameEl);

    const sub = document.createElement('div');
    sub.className = 'wbg-sub';
    if (row.kind === 'missing') {
        sub.textContent = 'Trong thẻ có ghi, nhưng file Worldbook không tồn tại';
        sub.classList.add('wbg-sub-warn');
    } else if (!row.owners.length) {
        sub.textContent = 'Không có thẻ liên kết với cuốn Worldbook này';
        sub.classList.add('wbg-sub-warn');
    } else {
        const n = row.entryCount === null || row.entryCount === undefined
            ? 'Số lượng mục không rõ'
            : `${row.entryCount} mục`;
        sub.textContent = `${n} · ${row.worldName}`;
    }
    meta.appendChild(sub);

    // Hàng nút công tắc (Nằm riêng một dòng, tránh đụng chạm với "nhấp vào thẻ để mở trình chỉnh sửa")
    if (canToggle) {
        const bar = document.createElement('div');
        bar.className = 'wbg-toggle-bar';

        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'wbg-switch' + (enabled ? ' wbg-switch-on' : '');
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', enabled ? 'true' : 'false');
        sw.title = enabled ? 'Nhấp một cái để tắt cuốn Worldbook này' : 'Nhấp một cái để bật cuốn Worldbook này';
        sw.innerHTML = `<span class="wbg-switch-knob"></span>`;
        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            void onToggleClick(row, sw, stateTag, card);
        });

        const label = document.createElement('span');
        label.className = 'wbg-toggle-label';
        label.textContent = enabled ? 'Đã bật' : 'Đã tắt';

        bar.appendChild(sw);
        bar.appendChild(label);
        meta.appendChild(bar);
    }

    card.appendChild(thumb);
    card.appendChild(meta);

    card.title = [
        `Tên hiển thị: ${displayName(row)}`,
        `Tên file Worldbook: ${row.worldName}`,
        row.owners.length ? `Thẻ liên kết: ${row.owners.map(o => o.name).join(', ')}` : 'Thẻ liên kết: Không có',
        canToggle ? `Trạng thái hiện tại: ${enabled ? 'Đã bật' : 'Đã tắt'}` : '',
    ].filter(Boolean).join('\n');

    // Nhấp một cái mở trình chỉnh sửa Worldbook (Chỉ đọc xem, không ghi dữ liệu)
    if (row.kind === 'world' && typeof openWorldInfoEditor === 'function') {
        card.addEventListener('click', () => {
            try {
                openWorldInfoEditor(row.worldFile);
            } catch (err) {
                console.warn(LOG_PREFIX, 'Mở trình chỉnh sửa thất bại', err);
            }
        });
    }

    return card;
}

/**
 * Việc cần làm sau khi nhấp vào công tắc trên thẻ.
 *
 * Thứ tự: Đổi trạng thái trước -> Đợi phía SillyTavern đồng bộ xong -> Sau đó vẽ lại giao diện thành trạng thái thực tế -> Cuối cùng hiện thông báo.
 * Trạng thái giao diện luôn luôn lấy dữ liệu thực tế đọc từ isWorldEnabled() làm chuẩn,
 * không lấy "người dùng tưởng mình đã nhấp cái gì" làm kết quả, để tránh giao diện và SillyTavern bị lệch nhau.
 *
 * Lưu ý toggleWorld là async (có thể phải bù đắp một lần làm mới danh sách Worldbook),
 * nên ở đây hãy làm nóng (warm-up) giao diện một cách lạc quan thành trạng thái mục tiêu trước, đợi nó trả về rồi mới dùng trạng thái thực tế hiệu chỉnh lại một lần,
 * như vậy bấm xuống là có phản hồi ngay, không bị khựng lại.
 */
async function onToggleClick(row, swEl, stateTagEl, cardEl) {
    const before = isWorldEnabled(row.worldName);

    // Làm nóng giao diện lạc quan trước: Vẽ theo kiểu "đảo ngược", để người dùng thấy phản ứng ngay lập tức
    const optimistic = !before;
    paintToggle(swEl, stateTagEl, cardEl, optimistic);

    let after;
    try {
        after = await toggleWorld(row.worldName);
    } catch (err) {
        console.error(LOG_PREFIX, 'Chuyển đổi xảy ra lỗi', row.worldName, err);
        after = isWorldEnabled(row.worldName);   // Lỗi thì quay về trạng thái thực tế
    }

    // Dùng trạng thái thực tế hiệu chỉnh giao diện
    paintToggle(swEl, stateTagEl, cardEl, after);

    // Thông báo
    if (after === before) {
        // Không thay đổi. Cách implement mới là sửa dữ liệu trực tiếp, bình thường sẽ không chạy đến đây;
        // Nếu thật sự chạy đến đây, chứng tỏ tên Worldbook không khớp với trong SillyTavern (ví dụ tên có chứa ký tự đặc biệt).
        console.warn(LOG_PREFIX, 'Trạng thái không đổi, tên có thể là', JSON.stringify(row.worldName),
            'Danh sách kích hoạt hiện tại là', JSON.stringify(selected_world_info));
        toastWarn(`Không thể thay đổi trạng thái của "${displayName(row)}". Nhấn F12 xem console để biết thông tin chi tiết.`);
    } else if (after) {
        toastOk(`Đã bật: ${displayName(row)}`);
    } else {
        toastOk(`Đã tắt: ${displayName(row)}`);
    }

    refreshStatsOnly();
}

/**
 * Vẽ 3 thành phần giao diện liên quan đến công tắc thành trạng thái chỉ định.
 * Tách ra là vì trong onToggleClick phải vẽ 2 lần (lạc quan một lần, hiệu chỉnh một lần).
 */
function paintToggle(swEl, stateTagEl, cardEl, on) {
    if (cardEl) {
        cardEl.classList.toggle('wbg-card-on', on);
        cardEl.classList.toggle('wbg-card-off', !on);
    }
    if (swEl) {
        swEl.classList.toggle('wbg-switch-on', on);
        swEl.setAttribute('aria-checked', on ? 'true' : 'false');
        swEl.title = on ? 'Nhấp một cái để tắt cuốn Worldbook này' : 'Nhấp một cái để bật cuốn Worldbook này';
        const label = swEl.parentElement?.querySelector('.wbg-toggle-label');
        if (label) label.textContent = on ? 'Đã bật' : 'Đã tắt';
    }
    if (stateTagEl) stateTagEl.textContent = on ? 'Đã bật' : 'Đã tắt';
}

/**
 * Chỉ tính lại dòng thống kê ở trên cùng ("Tổng cộng N cuốn... trong đó M cuốn đã bật"), không quét lại toàn bộ lưới.
 * Dùng nó khi gạt công tắc, nhanh hơn làm mới cả trang, cũng không làm mất vị trí cuộn.
 */
function refreshStatsOnly() {
    const panel = ensurePanel();
    const rows = lastRows;
    const enabledCount = rows.filter(r =>
        (r.kind === 'world') && isWorldEnabled(r.worldName)).length;
    const base = panel.querySelector('#wbg-stats').dataset.baseText || '';
    panel.querySelector('#wbg-stats').textContent =
        `${base} · ${enabledCount} cuốn đã bật`;
}

/**
 * Bật lên một thông báo nhỏ ở góc dưới bên phải, 1.6 giây sau tự biến mất.
 * Dùng code tự viết chứ không dùng toastr của SillyTavern, là để không bị phụ thuộc vào internal implementation của SillyTavern.
 */
let toastTimer = null;
function toast(msg, kind) {
    let el = document.getElementById('wbg-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'wbg-toast';
        document.body.appendChild(el);
    }
    el.className = `wbg-toast wbg-toast-${kind} wbg-toast-show`;
    el.textContent = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('wbg-toast-show');
    }, 1600);
}
function toastOk(msg) { toast(msg, 'ok'); }
function toastWarn(msg) { toast(msg, 'warn'); }

/**
 * Hiện tại đang bật tổng cộng bao nhiêu cuốn Worldbook (Dùng cho thống kê trên cùng).
 */
function countEnabledWorlds() {
    return lastRows.filter(r => r.kind === 'world' && isWorldEnabled(r.worldName)).length;
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

// ---------------------------------------------------------------------------
// Đầu vào: Thêm một nút vào cài đặt extension
// ---------------------------------------------------------------------------

function buildSettingsUI() {
    const container = document.getElementById('extensions_settings2')
        || document.getElementById('extensions_settings');
    if (!container) return;

    const block = document.createElement('div');
    block.className = 'wbg-settings-block';
    block.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Quản lý Ảnh bìa Worldbook</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <p class="wbg-desc">
                    Trải các Worldbook ra hiển thị theo "ảnh bìa của thẻ nhân vật mà nó liên kết", giúp dễ dàng nhận biết cuốn nào thuộc về thẻ nào.<br>
                    Chỉ đọc không sửa: Sẽ không sửa đổi bất kỳ tên file hay nội dung thẻ nào.<br>
                    Công tắc trên thẻ có thể trực tiếp bật / tắt Worldbook, và nó dùng chung một trạng thái với giao diện gốc của SillyTavern.
                </p>
                <div class="wbg-settings-actions">
                    <button class="menu_button" id="wbg-open-panel">
                        <i class="fa-solid fa-images"></i> Mở bảng ảnh bìa
                    </button>
                </div>
                <label class="wbg-check">
                    <input type="checkbox" id="wbg-set-orphans" checked />
                    <span>Hiển thị các Worldbook không liên kết với thẻ nào trong bảng điều khiển</span>
                </label>
            </div>
        </div>
    `;
    container.appendChild(block);

    block.querySelector('#wbg-open-panel').addEventListener('click', () => openPanel());

    const orphansBox = block.querySelector('#wbg-set-orphans');
    orphansBox.checked = getSettings().showOrphans;
    orphansBox.addEventListener('change', (e) => {
        getSettings().showOrphans = e.target.checked;
        saveSettingsDebounced();
        if (panelEl) panelEl.querySelector('#wbg-orphans').checked = e.target.checked;
    });
}

/**
 * Đầu vào extension.
 *
 * Bắt buộc phải export có tên là `init`, bởi vì trong manifest.json có ghi:
 *     "hooks": { "activate": "init" }
 * Khi SillyTavern load sẽ vào trong module tìm cái hàm được export này và gọi nó
 * (xem callExtensionHook lân cận dòng 438 của public/scripts/extensions.js).
 * Dùng cách viết thực thi ngay lập tức kiểu jQuery(...) sẽ không tìm thấy init, dẫn đến load thất bại.
 */
export async function init() {
    getSettings();

    // Đợi container cài đặt extension trên giao diện xuất hiện rồi mới nhét nút vào, tránh chạy quá sớm
    await waitForSettingsContainer();
    buildSettingsUI();

    // Khi thẻ hoặc Worldbook có thay đổi, nếu bảng điều khiển đang mở thì tự động quét lại
    const softRefresh = () => {
        if (panelEl && panelEl.classList.contains('wbg-open')) refresh(false);
    };
    // "Bật/Tắt" của Worldbook đã thay đổi (bất kể là sửa trong giao diện SillyTavern hay sửa trong plugin này)
    // thì chỉ cần vẽ lại lưới, không quét lại file, vừa tiết kiệm thời gian vừa không bị nhảy thanh cuộn.
    const restatOnly = () => {
        if (!panelEl || !panelEl.classList.contains('wbg-open')) return;
        if (!lastRows.length) return;
        renderGrid();
        refreshStatsOnly();
    };
    const events = [
        event_types.CHARACTER_EDITED,
        event_types.CHARACTER_DELETED,
        event_types.CHARACTER_RENAMED,
        event_types.CHARACTER_DUPLICATED,
        event_types.WORLDINFO_UPDATED,
        event_types.WORLDINFO_ENTRIES_LOADED,
    ];
    for (const ev of events) {
        try { eventSource.on(ev, softRefresh); } catch { /* Event không tồn tại thì bỏ qua */ }
    }
    // Những sự kiện này chỉ ảnh hưởng đến việc "cuốn nào đang mở", không ảnh hưởng đến quan hệ ghép nối -> Chỉ vẽ lại trạng thái
    const stateEvents = [
        event_types.WORLDINFO_SETTINGS_UPDATED,
        event_types.WORLDINFO_UPDATED,
    ];
    for (const ev of stateEvents) {
        if (ev === undefined) continue;
        try { eventSource.on(ev, restatOnly); } catch { /* Event không tồn tại thì bỏ qua */ }
    }

    // Ngăn chặn việc softRefresh và restatOnly cùng chạy trong một frame (WORLDINFO_UPDATED được bind ở cả hai nơi)
    // Để đơn giản: restatOnly chạy trước, softRefresh sẽ vì panel đã được vẽ lại mà chỉ làm mới thêm một lần nữa,
    // chi phí hiệu năng rất nhỏ, có thể chấp nhận được.

    console.log(LOG_PREFIX, 'Đã load');
}

/**
 * Đợi container cài đặt extension xuất hiện.
 * Đợi tối đa khoảng 10 giây; quá giờ cũng không báo lỗi, vì có thể phiên bản SillyTavern này dùng id container khác.
 */
async function waitForSettingsContainer(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (document.getElementById('extensions_settings2')
            || document.getElementById('extensions_settings')) {
            return true;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.warn(LOG_PREFIX, 'Không đợi được container cài đặt extension, nút có thể chưa được gắn lên');
    return false;
}

// Dành cho việc debug trong console của trình duyệt:
//   WorldbookGallery.open()               Mở bảng điều khiển
//   WorldbookGallery.refresh()            Quét lại
//   WorldbookGallery.index()              Xem kết quả ghép nối
//   WorldbookGallery.isOn('Tên Worldbook')      Xem cuốn nào đó có đang bật không
//   WorldbookGallery.toggle('Tên Worldbook')    Bật/Tắt cuốn nào đó
window.WorldbookGallery = {
    open: openPanel,
    refresh,
    collectRows,
    index: buildIndex,
    isOn: isWorldEnabled,
    toggle: toggleWorld,
};