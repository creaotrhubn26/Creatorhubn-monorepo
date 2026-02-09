const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

async function svgToPng(inputFile, outputFile) {
  try {
    const inputPath = path.resolve(inputFile);
    const outputPath = path.resolve(outputFile);

    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Input file not found at ${inputPath}`);
      return;
    }

    await sharp(inputPath)
      .resize(512, 512)
      .png({
        quality: 90,
        compressionLevel: 9,
        palette: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Explicitly set transparent background
      })
      .toFile(outputPath);
    
    console.log(`✅ Transparent PNG created successfully: ${outputFile}`);
  } catch (error) {
    console.error('Error during SVG to PNG conversion:', error.message);
  }
}

// Simple command-line argument parsing
const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith('--input='));
const outputArg = args.find(arg => arg.startsWith('--output='));

if (inputArg && outputArg) {
  const inputFile = inputArg.split('=')[1];
  const outputFile = outputArg.split('=')[1];
  svgToPng(inputFile, outputFile);
} else {
  // Default behavior if no args
  const defaultInput = 'public/bride-groom-gemini-icon.svg';
  const defaultOutput = 'public/bride-groom-gemini-icon.png';
  if (fs.existsSync(defaultInput)) {
    svgToPng(defaultInput, defaultOutput);
  } else {
    console.log('Usage: node convert-svg.cjs --input=<path/to/input.svg> --output=<path/to/output.png>');
  }
}
