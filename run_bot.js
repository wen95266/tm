import { execSync } from 'child_process';
try {
  execSync('python3 bot.py', { stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
