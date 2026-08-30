const fs = require('fs');
const files = [
  'apps/web/app/api/extract/route.ts',
  'apps/web/app/api/map/route.ts',
  'apps/web/app/api/grade/route.ts',
  'apps/web/app/api/health/route.ts',
  'apps/web/.env.local'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/OMNIROUTE_BASE_URL/g, 'AI_BASE_URL');
  content = content.replace(/OMNIROUTE_API_KEY/g, 'AI_API_KEY');
  content = content.replace(/OMNIROUTE_EXTRACTION_MODEL/g, 'AI_MODEL');
  content = content.replace(/OMNIROUTE_MAPPING_MODEL/g, 'AI_MODEL');
  content = content.replace(/OMNIROUTE_GRADING_MODEL/g, 'AI_MODEL');
  content = content.replace(/OMNIROUTE_SUMMARY_MODEL/g, 'AI_MODEL');
  content = content.replace(/OMNIROUTE_VISION_MODEL/g, 'AI_MODEL');
  
  if (f === 'apps/web/.env.local') {
    // If it's corrupted due to previous powershell run, we might need to handle UTF-16
    // Actually, .env.local might be corrupted now.
    // Let's just recreate it entirely.
  }
  
  fs.writeFileSync(f, content, 'utf8');
});
