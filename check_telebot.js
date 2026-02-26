import { execSync } from 'child_process';
try {
  execSync('python3 -c "import telebot"', { stdio: 'inherit' });
  console.log('telebot ok');
} catch (e) {
  console.error(e);
}
