/**
 * Xác minh tính khả dụng của API khi chạy (runtime)
 *
 * Kiểm tra xem mỗi tên import được dùng trong index.js có thật sự được export từ file tương ứng hay không.
 * Chỉ nhìn code thôi thì dễ sót lắm, ở đây chúng ta sẽ xác nhận từng symbol một.
 *
 * Hỗ trợ hai cách viết export:
 *   export const foo / export let foo / export function foo
 *   export { a, b, foo, c };   <- Export dạng khối (block) nhiều dòng, dùng regex rất dễ bỏ sót
 *
 * Cách tìm thư mục SillyTavern: Ưu tiên dùng biến môi trường TAVERN_ROOT, tiếp theo là tìm ngược lên trên từ vị trí của script này.
 * Ví dụ: TAVERN_ROOT="D:/SillyTavern" node _verify_api.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_INDEX = path.join(HERE, 'index.js');

/**
 * Tìm thư mục gốc của SillyTavern: Xem biến môi trường trước, sau đó đoán từ các vị trí phổ biến.
 * Tiêu chí đánh giá là "có tồn tại public/scripts/world-info.js".
 */
function findTavernRoot() {
    const isTavern = (p) => p && fs.existsSync(path.join(p, 'public', 'scripts', 'world-info.js'));

    if (process.env.TAVERN_ROOT && isTavern(process.env.TAVERN_ROOT)) {
        return path.resolve(process.env.TAVERN_ROOT);
    }

    const candidates = [];
    // Tìm ngược lên trên từ vị trí của script
    let walk = HERE;
    for (let i = 0; i < 8; i++) {
        walk = path.dirname(walk);
        if (walk === path.dirname(walk)) break;
        candidates.push(walk);
    }
    // Quét qua một lượt các ổ đĩa phổ biến
    for (const drive of ['C:', 'D:', 'E:', 'F:', 'G:']) {
        const base = drive + path.sep;
        if (!fs.existsSync(base)) continue;
        let items = [];
        try { items = fs.readdirSync(base, { withFileTypes: true }); } catch { continue; }
        for (const it of items) {
            if (it.isDirectory() && /sillytavern/i.test(it.name)) {
                candidates.push(path.join(base, it.name));
            }
        }
    }
    return candidates.find(isTavern) ?? null;
}

const TAVERN = findTavernRoot();

if (!TAVERN) {
    console.log('=== Xác minh tính khả dụng của API khi chạy (runtime) ===');
    console.log('');
    console.log('Không tìm thấy thư mục SillyTavern, bỏ qua bước kiểm tra này.');
    console.log('Nếu muốn dùng, hãy chỉ định một chút: TAVERN_ROOT="D:/SillyTavern" node _verify_api.mjs');
    process.exit(0);
}

// Trích xuất "Tên file -> Danh sách symbol" từ mỗi câu lệnh import của index.js
const src = fs.readFileSync(SRC_INDEX, 'utf8');

const groups = [];
const re = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g;
let m;
while ((m = re.exec(src)) !== null) {
    const names = m[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.split(/\s+as\s+/)[0].trim());
    groups.push({ from: m[2], names });
}

// Lấy tất cả các tên được export trong một file nào đó (bao gồm cả dạng khối export {})
function getExports(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const out = new Set();

    // Dạng 1: export const/let/var/function/class NAME
    const re1 = /^\s*export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
    let x;
    while ((x = re1.exec(text)) !== null) out.add(x[1]);

    // Dạng 2: export { a, b, c }; hoặc export { a as b };
    const re2 = /^\s*export\s*\{([\s\S]*?)\}\s*;?/gm;
    while ((x = re2.exec(text)) !== null) {
        x[1].split(',').forEach(part => {
            part = part.trim();
            if (!part) return;
            part = part.replace(/\/\*[\s\S]*?\*\//g, '').trim();
            const asMatch = part.match(/\bas\s+([A-Za-z_$][\w$]*)/);
            const name = asMatch ? asMatch[1] : part.replace(/^\s*type\s+/, '').trim();
            if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
        });
    }
    return out;
}

// Mô phỏng "thư mục extension sau khi cài vào SillyTavern", dùng để phân tích cú pháp (parse) các import tương đối
const EXT_DIR = path.join(
    TAVERN, 'public', 'scripts', 'extensions', 'third-party', 'worldbook-gallery',
);

console.log('=== Xác minh tính khả dụng của API khi chạy (runtime) ===');
console.log('Thư mục SillyTavern: ' + TAVERN);
console.log('');

let pass = 0, fail = 0;

for (const g of groups) {
    const target = path.resolve(EXT_DIR, g.from);
    const rel = target.slice(TAVERN.length + 1).replace(/\\/g, '/');
    console.log(`File nguồn: ${rel}`);

    if (!fs.existsSync(target)) {
        console.log('  ❌ File không tồn tại! (Chứng tỏ số tầng của đường dẫn tương đối bị sai)');
        console.log('');
        fail += g.names.length;
        continue;
    }

    const exported = getExports(target);

    for (const name of g.names) {
        if (exported.has(name)) {
            pass++;
            console.log(`  ✅ ${name}`);
        } else {
            fail++;
            console.log(`  ❌ ${name}  - File này không hề export tên này`);
        }
    }
    console.log('');
}

console.log(`=== Kết quả: ${pass} symbol khả dụng, ${fail} cái có vấn đề ===`);
process.exit(fail ? 1 : 0);