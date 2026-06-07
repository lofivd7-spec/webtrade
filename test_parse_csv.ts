import fs from 'fs';
const text = `Bad Bunnz,#BUNNZ #2230,0.154,https://bunnz.com/2230.png`;
const parts = text.split(',');
const codePart = parts[1].trim();
const codeKey = codePart.replace(/^#/, '').trim();
console.log("codeKey:", codeKey);
console.log("codeOnly:", codeKey.replace(/[^A-Z0-9]/gi, ''));
