const mineflayer = require('mineflayer');
const navigatePlugin = require('./navigate')(mineflayer);
const getTps = require('./getTps');
class bot {
  static list=[];
  constructor(options) {
    this.bot=mineflayer.createBot(options);
    navigatePlugin(this.bot);
    this.id=bot.list.length;
    bot.list.push(this);
    this.bot.navigate.on('pathFound', function (path) {
      this.bot.chat("found path. I can get there in " + path.length + " moves.");
    });
    this.bot.navigate.on('cannotFind', function (closestPath) {
      this.bot.chat("unable to find path. getting as close as possible");
      this.bot.navigate.walk(closestPath);
    });
    this.bot.navigate.on('arrived', function () {
      this.bot.chat("I have arrived");
    });
    this.bot.on('chat', function(username, message) {
      // navigate to whoever talks
      if (username === this.bot.username) return;
      const target = this.bot.players[username].entity;
      if (message === 'come') {
        this.bot.navigate.to(target.position);
      } else if (message === 'stop') {
        this.bot.navigate.stop();
      }
    });
  }
  tps = null;
  everySec =  setInterval(async ()=>{
    const oldtps = this.tps;
    this.tps = await getTps(this.bot);
    if(!oldtps&&this.tps) console.log('connected!');
    if(oldtps&&!this.tps) console.log('disconnected!');
    if(this.tps&&this.tps!==oldtps) {
      console.log(`tps: ${this.tps}`);
      clearInterval(this.everyTick);
      this.everyTick=setInterval(this.everyTickFunction,1000/this.tps);
    }
  },1000);
  everyTick = null;
  everyTickFunction = () => {}
}
const skyBot = new bot({
  username: 'SkyBot',
  host: 'localhost',
  port: 8219
});
navigatePlugin(bot);
