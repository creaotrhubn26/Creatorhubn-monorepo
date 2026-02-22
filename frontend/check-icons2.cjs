const m = require('@mui/icons-material');
console.log('Volume icons:', Object.keys(m).filter(k => k.startsWith('Volume') && k.includes('Outlined')).join(', '));
console.log('Chevron/Arrow Down:', Object.keys(m).filter(k => (k.includes('ChevronDown') || k === 'KeyboardArrowDown' || k === 'ExpandMore' || k === 'ArrowDropDown')).join(', '));
