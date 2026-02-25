import { execSync } from 'child_process';
try {
  execSync('python3 -m py_compile bot.py');
  console.log('bot.py syntax ok');
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
try {
  execSync('python3 -m py_compile modules/utils.py');
  console.log('utils.py syntax ok');
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
try {
  execSync('python3 -m py_compile modules/config.py');
  console.log('config.py syntax ok');
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
try {
  execSync('python3 -m py_compile modules/alist.py');
  console.log('alist.py syntax ok');
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
try {
  execSync('python3 -m py_compile modules/menus.py');
  console.log('menus.py syntax ok');
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
try {
  execSync('python3 -m py_compile modules/monitor.py');
  console.log('monitor.py syntax ok');
} catch (e) {
  console.error(e.stdout.toString());
  console.error(e.stderr.toString());
}
