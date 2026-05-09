const fs = require('fs');
const path = require('path');

// Mapping de caracteres corruptos UTF-8 → caracteres correctos
const encodingMap = {
  'Â¿': '¿',
  'Â¡': '¡',
  'Â«': '«',
  'Â»': '»',
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã­': 'í',
  'Ã³': 'ó',
  'Ã¹': 'ú',
  'Ã±': 'ñ',
  'Ã ': 'à',
  'Ã¸': 'ø',
  'Ã†': 'Æ',
  'Ã‰': 'É',
  'à‰': 'É',
  'Ã"': 'Ó',
  'Ã•': 'Õ',
  'Ã¢': 'â',
  'Ã¤': 'ä',
  'Ã§': 'ç',
  'Ã¨': 'è',
  'Ãª': 'ê',
  'Ã«': 'ë',
  'Ã¬': 'ì',
  'Ã®': 'î',
  'Ã¯': 'ï',
  'Ã°': 'ð',
  'Ã²': 'ò',
  'Ã´': 'ô',
  'Ã¶': 'ö',
  'Ãº': 'ú',
  'Ã»': 'û',
  'Ã¼': 'ü',
  'Ã½': 'ý',
  'Ã¾': 'þ',
  'ÃŸ': 'ß'
};

function fixEncoding(text) {
  let result = text;
  for (const [broken, correct] of Object.entries(encodingMap)) {
    const regex = new RegExp(broken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, correct);
  }
  return result;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = fixEncoding(content);
    
    // Validar que sea JSON válido
    JSON.parse(fixed);
    
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`✓ Arreglado: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error en ${filePath}: ${error.message}`);
    return false;
  }
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  
  console.log(`\nProcesando ${files.length} archivos en: ${dirPath}\n`);
  
  let fixed = 0;
  for (const file of files) {
    if (processFile(path.join(dirPath, file))) {
      fixed++;
    }
  }
  
  console.log(`\n✓ ${fixed}/${files.length} archivos arreglados en ${dirPath}\n`);
  return fixed;
}

// Procesar ambas carpetas
const latamDir = path.join(__dirname, 'backend', 'content', 'latam');
const spainDir = path.join(__dirname, 'backend', 'content', 'spain');

console.log('=== Arreglando encoding UTF-8 ===\n');

const latamCount = processDirectory(latamDir);
const spainCount = processDirectory(spainDir);

console.log(`\n=== RESUMEN ===`);
console.log(`Total de archivos arreglados: ${latamCount + spainCount}`);
