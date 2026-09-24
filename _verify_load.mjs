/**
 * Xác minh quá trình load: Đặt index.js vào một cây thư mục SillyTavern giả lập, dùng semantic ES module thật để import thử một lần.
 *
 * Tại sao lại cần cái này: Những vấn đề kiểu "load extension thất bại", chỉ nhìn text code thôi thì không thể nào nhìn ra được.
 * Phiên bản trước chính vì dựa vào "đọc code thấy đúng" nên đã release, kết quả là SillyTavern báo lỗi `[object Event]`.
 * Script này có thể trả lời một cách chắc chắn ba điều:
 *   1. Đường dẫn import có phân giải được đến file thật hay không
 *   2. Hàm mà hooks.activate trỏ tới trong manifest có thực sự được export hay không
 *   3. Khi gọi init có ném ra exception (ngoại lệ) hay không
 *
 * Cách sử dụng: node _verify_load.mjs
 *
 * Chú ý: Ở đây dùng import động cùng tiến trình (same-process dynamic import), không khởi chạy tiến trình con - môi trường sandbox cấm spawn (sẽ bị EBUSY).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_INDEX = path.join(HERE, 'index.js');
const SRC_MANIFEST = path.join(HERE, 'manifest.json');

const manifest = JSON.parse(fs.readFileSync(SRC_MANIFEST, 'utf8'));
const hookFn = manifest?.hooks?.activate;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wbg-load-'));
const pub = path.join(tmp, 'public');
const extDir = path.join(pub, 'scripts', 'extensions', 'third-party', 'worldbook-gallery');

fs.mkdirSync(extDir, { recursive: true });

// ---- Stub module (Module giả): Chỉ cung cấp các export mà index.js khai báo cần dùng ----
const stubs = {
    [path.join(pub, 'script.js')]: `
        export const eventSource = { on(){}, off(){}, emit(){} };
        export const event_types = new Proxy({}, { get: (t, k) => 'ev:' + String(k) });
        export const getRequestHeaders = () => ({});
        export const getThumbnailUrl = () => '';
        export const characters = [];
        export const saveSettingsDebounced = () => {};
    `,
    [path.join(pub, 'scripts', 'world-info.js')]: `
        export const world_names = [];
        export let selected_world_info = [];
        export const openWorldInfoEditor = () => {};
        export const updateWorldInfoList = async () => {};
    `,
    [path.join(pub, 'scripts', 'extensions.js')]: `
        export const extension_settings = {};
    `,
};
for (const [p, code] of Object.entries(stubs)) {
    fs.writeFileSync(p, code, 'utf8');
}

fs.copyFileSync(SRC_INDEX, path.join(extDir, 'index.js'));
fs.copyFileSync(SRC_MANIFEST, path.join(extDir, 'manifest.json'));

// ---- Môi trường trình duyệt giả ----
const mkEl = () => ({
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, addEventListener() {},
    querySelector() { return mkEl(); },
    remove() {},
    innerHTML: '', textContent: '', title: '', value: '', checked: false,
});
globalThis.document = {
    readyState: 'complete',
    body: { contains() { return true; }, appendChild() {} },
    getElementById() { return null; },
    querySelector() { return null; },
    createElement() { return mkEl(); },
};
globalThis.window = globalThis;
globalThis.jQuery = (fn) => fn();
globalThis.fetch = async () => ({ ok: true, json: async () => [] });
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

// ---- Chạy ----
console.log('=== Xác minh quá trình load ===');

let mod;
try {
    mod = await import(pathToFileURL(path.join(extDir, 'index.js')).href);
} catch (e) {
    console.log(`  ❌ Load module thất bại`);
    console.log(`     ${e.constructor.name}: ${e.message}`);
    console.log('');
    console.log('=== Phán định ===');
    console.log('  ❌ Đường dẫn import hoặc symbol import có vấn đề, khi SillyTavern load sẽ báo lỗi');
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    process.exit(1);
}

console.log('  ✅ Load module thành công');
console.log(`     Symbol được export: ${Object.keys(mod).sort().join(', ') || '(Không có)'}`);

if (hookFn && typeof mod[hookFn] !== 'function') {
    console.log(`  ❌ manifest ghi là hooks.activate="${hookFn}", nhưng module không hề export hàm này`);
    console.log('');
    console.log('=== Phán định ===');
    console.log('  ❌ SillyTavern sẽ vì thế mà load thất bại. init bắt buộc phải là export function.');
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    process.exit(1);
}
console.log(`  ✅ Hàm hook "${hookFn}" có tồn tại`);

try {
    await mod[hookFn]();
    console.log('  ✅ Gọi init không có exception');
} catch (e) {
    console.log(`  ❌ init ném ra exception: ${e.message}`);
    console.log('');
    console.log('=== Phán định ===');
    console.log('  ❌ init thực thi bị lỗi, cần phải sửa');
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    process.exit(1);
}

console.log('');
console.log('=== Phán định ===');
console.log('  ✅ Pass toàn bộ: Có thể load, hook tồn tại, init không có exception');

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
process.exit(0);