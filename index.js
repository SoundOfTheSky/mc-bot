const mineflayer = require('mineflayer');
const navigate = require('./navigate');
const getTps = require('./getTps');
const vec3 = require('vec3');
class bot {
  static list = [];
  constructor(options) {
    this.bot = mineflayer.createBot(options);
    this.id = bot.list.length;
    this.navigator = new navigate(this.bot);
    this.bot.on('chat', (username, message) => {
      if (username === this.bot.username) return;
      const target = this.bot.players[username].entity;
      if (message === 'come') this.bot.navigate(target.position);
      if (message === 'hey') this.bot.lookAt(target.position);
    });
  }
  lastPosition = vec3(0, 0, 0);
  everySec = setInterval(async () => {}, 1000);
  everyTick = setInterval(() => {
    if (!this.bot.entity) return;
    //if (!this.connected) console.log(this.bot.physics);
    this.connected = true;
    let p = this.bot.entity.position.floored();
    if (!this.lastPosition.equals(p)) {
      this.lastPosition = p;
      const b0 = this.bot.blockAt(p.offset(0, -1, 0));
      const b1 = this.bot.blockAt(p);
      const b2 = this.bot.blockAt(p.offset(0, 1, 0));
      if ([b0, b1, b2].find(b => b.type === 8 || b.type === 9)) this.bot.physics.gravity = 0;
      else this.bot.physics.gravity = 27;
    }
  }, 50);
  connected = false;
}
const skyBot = new bot({
  username: 'SkyBot',
  host: 'localhost',
  port: 8107,
});
