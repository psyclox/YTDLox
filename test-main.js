const electron = require('electron');
console.log('electron =', Object.keys(electron));
console.log('app =', electron.app);
if (electron.app) {
  console.log('it worked!');
  electron.app.quit();
} else {
  console.log('app is undefined!');
  process.exit(1);
}
