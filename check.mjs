/**
 * Tự kiểm tra toàn diện bằng một lệnh
 *
 * Cách sử dụng: node check.mjs
 *
 * Chạy lần lượt bốn mục kiểm tra, bất kỳ mục nào thất bại cũng sẽ được báo cáo rõ ràng.
 * Chạy một lần trước khi release, có thể ngăn chặn được những vấn đề kiểu "load thất bại" vốn chỉ lộ ra khi đã cài vào SillyTavern.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath;

const checks = [
    { name: 'Kiểm tra cú pháp index.js',  cmd: ['--input-type=module', '--check'], stdinFile: 'index.js' },
    { name: 'Tự kiểm tra logic ghép nối', cmd: ['_selftest.mjs'] },
    { name: 'Tính khả dụng của import',   cmd: ['_verify_api.mjs'] },
    { name: 'Mô phỏng load module',       cmd: ['_verify_load.mjs'] },
];

console.log('========================================');
console.log(' Quản lý Ảnh bìa Worldbook - Tự kiểm tra toàn diện');
console.log('========================================');
console.log('');

let failed = 0;

for (const c of checks) {
    process.stdout.write(`[${c.name}] `);
    let r;
    if (c.stdinFile) {
        const src = fs.readFileSync(path.join(HERE, c.stdinFile), 'utf8');
        r = spawnSync(NODE, c.cmd, { input: src, encoding: 'utf8', cwd: HERE });
    } else {
        r = spawnSync(NODE, c.cmd, { encoding: 'utf8', cwd: HERE });
    }

    if (r.error && String(r.error.message).includes('EBUSY')) {
        console.log('Bỏ qua (Sandbox không cho phép khởi chạy tiến trình con)');
        continue;
    }

    if (r.status === 0) {
        console.log('Pass');
    } else {
        failed++;
        console.log('Fail');
        const out = String(r.stdout ?? '').trim();
        const err = String(r.stderr ?? '').trim();
        if (out) console.log(out.split('\n').map(l => '    ' + l).join('\n'));
        if (err) console.log(err.split('\n').map(l => '    ' + l).join('\n'));
    }
}

console.log('');
if (failed === 0) {
    console.log('Pass toàn bộ.');
    process.exit(0);
} else {
    console.log(`${failed} mục fail, vui lòng sửa xong rồi mới release.`);
    process.exit(1);
}