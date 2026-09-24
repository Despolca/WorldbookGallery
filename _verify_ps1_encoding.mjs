/**
 * Tự kiểm tra bảng mã của script PowerShell.
 *
 * Tại sao lại cần cái này:
 *   Khi Windows PowerShell 5.1 đọc file .ps1, **nếu file không có UTF-8 BOM,
 *   nó sẽ giải mã theo code page ANSI của hệ thống (như hệ thống tiếng Trung là GBK)**.
 *   Trong install.ps1 toàn là chú thích tiếng Việt (sau khi dịch), một khi bị giải mã sai sẽ biến thành chữ rác (mojibake),
 *   trình phân tích cú pháp sẽ báo lỗi ở những vị trí kỳ quặc (ví dụ "thiếu dấu ngoặc đóng }"), làm script không thể chạy được.
 *
 *   Đã test thực tế: Cùng một file, đọc bằng UTF-8 -> 0 lỗi cú pháp;
 *         đọc bằng mặc định (không BOM + ANSI) -> 6 lỗi cú pháp.
 *
 * Script này kiểm tra: install.ps1 có BOM hay không, có thực sự là chuẩn UTF-8 hợp lệ hay không.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.join(HERE, 'install.ps1');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m, e) => { fail++; console.log(`  ❌ ${m}${e ? ' -> ' + e : ''}`); };

console.log('=== Tự kiểm tra bảng mã script PowerShell ===\n');

if (!fs.existsSync(TARGET)) {
    console.log('  ⚠️  Không tìm thấy install.ps1, bỏ qua.');
    process.exit(0);
}

const buf = fs.readFileSync(TARGET);

// [1] BOM
console.log('[1] Kiểm tra BOM');
if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    ok('Có UTF-8 BOM (PowerShell 5.1 mới có thể đọc đúng tiếng Việt)');
} else {
    no('Thiếu UTF-8 BOM',
        'PowerShell 5.1 sẽ giải mã sai, chú thích tiếng Việt biến thành chữ rác -> lỗi cú pháp -> script không chạy được');
}

// [2] Có phải UTF-8 hợp lệ không (Chế độ nghiêm ngặt, byte không hợp lệ sẽ ném lỗi)
console.log('\n[2] Tính hợp lệ của UTF-8');
try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    ok('Là UTF-8 hợp lệ');

    // [3] Tiếng Việt không bị hỏng (Kiểm tra ngẫu nhiên vài chữ bắt buộc phải có)
    console.log('\n[3] Kiểm tra tính toàn vẹn của văn bản tiếng Việt');
    const probes = [
        ['Worldbook', 'Giải thích tiếng Việt ở phần đầu'],
        ['Cài đặt', 'Chữ liên quan đến cài đặt'],
        ['Gỡ cài đặt', 'Chữ liên quan đến gỡ cài đặt'],
        ['Cập nhật', 'Action cập nhật mới thêm'],
    ];
    for (const [needle, why] of probes) {
        if (text.includes(needle)) ok(`Tìm thấy "${needle}" (${why})`);
        else no(`Không tìm thấy "${needle}" (${why})`);
    }

    // [4] Các action quan trọng đều có mặt
    console.log('\n[4] Tính đầy đủ của các action');
    for (const action of ['install', 'update', 'uninstall', 'status']) {
        if (text.includes(`'${action}'`)) ok(`Action ${action} có tồn tại`);
        else no(`Thiếu action ${action}`);
    }
} catch (e) {
    no('Không phải UTF-8 hợp lệ', String(e.message || e));
    console.log(`\n=== Kết quả: ${pass} mục pass, ${fail} mục fail ===`);
    process.exit(1);
}

console.log(`\n=== Kết quả: ${pass} mục pass, ${fail} mục fail ===`);
process.exit(fail ? 1 : 0);