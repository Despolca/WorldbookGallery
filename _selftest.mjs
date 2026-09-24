/**
 * Script tự kiểm tra: Không phụ thuộc vào trình duyệt, thuần túy dùng Node để chạy logic ghép nối cốt lõi.
 * Mục đích: Trước khi đưa plugin vào SillyTavern, phải chứng minh thuật toán "ghép nối Thẻ <-> Worldbook" là đúng.
 *
 * Cách làm: Lôi vài hàm thuần túy (pure functions) trong index.js ra (buildIndex / displayName),
 * dùng dữ liệu giả đã cấu trúc để chạy thử một lần, kiểm tra xem output có đúng như kỳ vọng không.
 */

// ---- Các logic thuần túy copy từ index.js (giữ đồng bộ, khi sửa thì sửa cả hai bên) ----

function buildIndex(characters) {
    const byWorld = new Map();
    const embedded = [];

    for (let chid = 0; chid < characters.length; chid++) {
        const ch = characters[chid];
        if (!ch) continue;

        const avatar = ch.avatar;
        const cardName = ch.name || (avatar ? avatar.replace(/\.png$/i, '') : '(Vô danh)');

        const worldName = ch?.data?.extensions?.world;
        if (worldName) {
            if (!byWorld.has(worldName)) byWorld.set(worldName, []);
            byWorld.get(worldName).push({ avatar, name: cardName, chid });
        }

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

function displayName(row, style = 'both') {
    const card = row.primaryCardName;
    const world = row.worldName;

    if (!card) {
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

// ---- Cấu trúc dữ liệu test ----

// Kịch bản 1: Import nguyên thẻ - extensions.world của thẻ trỏ vào Worldbook của chính nó
// Kịch bản 2: Một thẻ import nhiều lần, có nhiều Worldbook (Mô phỏng "import nhiều lần tên bị biến dạng")
// Kịch bản 3: Thẻ đi kèm character_book nhưng file Worldbook chưa được import
// Kịch bản 4: Một cuốn Worldbook bị cô lập, không có thẻ nào liên kết
const fakeCharacters = [
    {
        avatar: 'Lilith.png',
        name: 'Lilith',
        data: { extensions: { world: 'Lilith·Aulos·Greyrat' } },
    },
    {
        avatar: 'Seraphina.png',
        name: 'Seraphina',
        data: { extensions: { world: 'Seraphina-World' } },
    },
    {
        // Cùng một thẻ bị import thêm lần nữa, tên Worldbook bị SillyTavern gắn thêm hậu tố -> tên biến dạng
        avatar: 'Seraphina 1.png',
        name: 'Seraphina',
        data: { extensions: { world: 'Seraphina-World-1' } },
    },
    {
        // Thẻ đi kèm Worldbook, nhưng chưa được import thành file độc lập
        avatar: 'Eris.png',
        name: 'Eris',
        data: {
            extensions: {},
            character_book: {
                name: 'Thế giới của Eris',
                entries: [{}, {}, {}],
            },
        },
    },
    {
        // Trong thẻ có ghi tên Worldbook, nhưng file đó không tồn tại
        avatar: 'The_ma.png',
        name: 'Thẻ ma',
        data: { extensions: { world: 'Worldbook đã bị xóa' } },
    },
];

// Các file Worldbook thực tế tồn tại trên ổ đĩa
const fakeWorldFiles = [
    { file_id: 'Lilith·Aulos·Greyrat', name: 'Lilith·Aulos·Greyrat' },
    { file_id: 'Seraphina-World', name: 'Seraphina-World' },
    { file_id: 'Seraphina-World-1', name: 'Seraphina-World-1' },
    { file_id: 'Mot_cai_ten_ky_quac_20240101', name: 'Mot_cai_ten_ky_quac_20240101' }, // Bị cô lập
];

function collectRows(characters, worlds) {
    const { byWorld, embedded } = buildIndex(characters);
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
        });
    }

    for (const [worldName, owners] of byWorld.entries()) {
        if (!seen.has(worldName)) {
            rows.push({
                kind: 'missing',
                worldFile: worldName,
                worldName,
                owners,
                primaryAvatar: owners[0]?.avatar ?? null,
                primaryCardName: owners[0]?.name ?? null,
            });
        }
    }

    return { rows, embedded };
}

// ---- Assertion ----

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log(`  ✅ ${label}`); }
    else {
        fail++;
        console.log(`  ❌ ${label}`);
        console.log(`     Kỳ vọng: ${JSON.stringify(expected)}`);
        console.log(`     Thực tế: ${JSON.stringify(actual)}`);
    }
}

console.log('=== Quản lý Ảnh bìa Worldbook - Tự kiểm tra logic ghép nối cốt lõi ===\n');

const { rows, embedded } = collectRows(fakeCharacters, fakeWorldFiles);

console.log('[1] Ghép nối Worldbook -> Thẻ');
const lilith = rows.find(r => r.worldName === 'Lilith·Aulos·Greyrat');
check('Worldbook của Lilith được ghép nối với thẻ "Lilith"', lilith.owners.map(o => o.name), ['Lilith']);
check('Ảnh bìa dùng file của thẻ', lilith.primaryAvatar, 'Lilith.png');

const s2 = rows.find(r => r.worldName === 'Seraphina-World-1');
check('Worldbook có hậu tố cũng có thể ghép nối với "Seraphina"', s2.owners.map(o => o.name), ['Seraphina']);

console.log('\n[2] Worldbook bị cô lập (Không có thẻ liên kết)');
const orphan = rows.find(r => r.worldName === 'Mot_cai_ten_ky_quac_20240101');
check('owners của Worldbook bị cô lập là rỗng', orphan.owners.length, 0);
check('Tên hiển thị của Worldbook bị cô lập có đánh dấu "Chưa liên kết thẻ"', displayName(orphan), 'Mot_cai_ten_ky_quac_20240101 (Chưa liên kết thẻ)');

console.log('\n[3] Có thẻ nhưng không có Worldbook');
const missing = rows.find(r => r.kind === 'missing');
check('Nhận diện được Worldbook bị thiếu', missing.worldName, 'Worldbook đã bị xóa');
check('Mục bị thiếu vẫn có thể hiển thị thẻ nào đang cần nó', missing.primaryCardName, 'Thẻ ma');

console.log('\n[4] Thẻ đi kèm Worldbook');
check('Nhận diện được 1 thẻ đi kèm Worldbook', embedded.length, 1);
check('Worldbook đi kèm thuộc về đúng chủ', embedded[0].name, 'Eris');
check('Số lượng mục của Worldbook đi kèm là chính xác', embedded[0].entryCount, 3);

console.log('\n[5] Ba kiểu tên hiển thị');
const row = { worldName: 'Seraphina-World', primaryCardName: 'Seraphina', owners: [{}] };
check('Kiểu both', displayName(row, 'both'), 'Seraphina · Seraphina-World');
check('Kiểu card', displayName(row, 'card'), 'Seraphina');
check('Kiểu world', displayName(row, 'world'), 'Seraphina-World');
const sameName = { worldName: 'Lilith', primaryCardName: 'Lilith', owners: [{}] };
check('Không lặp lại khi tên thẻ và tên Worldbook giống nhau', displayName(sameName, 'both'), 'Lilith');

console.log('\n[6] Tổng số dòng');
check('4 cuốn Worldbook + 1 cuốn bị thiếu = 5 dòng', rows.length, 5);

console.log(`\n=== Kết quả: ${pass} mục pass, ${fail} mục fail ===`);
process.exit(fail ? 1 : 0);