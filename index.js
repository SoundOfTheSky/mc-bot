const mineflayer = require('mineflayer');
const mineflayerViewer = require('prismarine-viewer').mineflayer;
//const vec3 = require('vec3');
const navigate = require('./navigate');
class bot {
  static list = [];
  constructor(options) {
    this.bot = mineflayer.createBot(options);
    this.id = bot.list.length;
    this.bot.on('chat', (username, message) => {
      if (username === this.bot.username) return;
      const target = this.bot.players[username].entity;
      if (message === 'come') this.bot.navigate(target.position);
      if (message === 'hey') this.bot.lookAt(target.position);
    });
    this.bot.once('spawn', () => {
      mineflayerViewer(this.bot, { port: 3007 });
      this.navigator = new navigate(this.bot);
      const path = [this.bot.entity.position.clone()];
      this.bot.on('move', () => {
        if (path[path.length - 1].distanceTo(this.bot.entity.position) > 1) {
          path.push(this.bot.entity.position.clone());
          this.bot.viewer.drawLine('path', path);
        }
      });
    });
  }
}
new bot({
  username: 'SkyBot',
  host: 'localhost',
  port: 53662,
});
