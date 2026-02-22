const m = require('@mui/icons-material');
const check = ['ChevronDown','ChevronRight','ChevronLeft','Filter','VolumeOutlined','Image','Home','Dashboard','Logout','Download','Publish','Rocket'];
check.forEach(c => console.log(c + ': ' + (m[c] ? 'YES' : 'NO')));
