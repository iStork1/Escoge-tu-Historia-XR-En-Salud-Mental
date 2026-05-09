const fs = require('fs');
const path = require('path');

function validateJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    console.log(`✓ ${path.basename(filePath)} - JSON válido`);
    return true;
  } catch (error) {
    console.error(`✗ ${path.basename(filePath)} - ERROR:`);
    console.error(`  Línea: ${error.message}`);
    return false;
  }
}

console.log('=== Validación de sintaxis JSON ===\n');

const latamDir = path.join(__dirname, 'backend', 'content', 'latam');
const spainDir = path.join(__dirname, 'backend', 'content', 'spain');

const files = [
  ...fs.readdirSync(latamDir).filter(f => f.endsWith('.json')).map(f => path.join(latamDir, f)),
  ...fs.readdirSync(spainDir).filter(f => f.endsWith('.json')).map(f => path.join(spainDir, f))
];

let valid = 0;
let invalid = 0;

for (const file of files) {
  if (validateJsonFile(file)) {
    valid++;
  } else {
    invalid++;
  }
}

console.log(`\n=== RESUMEN ===`);
console.log(`Válidos: ${valid}/${files.length}`);
if (invalid > 0) {
  console.log(`Inválidos: ${invalid}`);
  process.exit(1);
}
