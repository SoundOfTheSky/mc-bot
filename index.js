const mineflayer = require('mineflayer');
const navigation = require('./navigation');
const getTps = require('./getTps');
class bot {
  static list=[];
  constructor(options) {
    this.bot=mineflayer.createBot(options);
    this.id=bot.list.length;
    this.bot.on('chat', (username, message)=>{
      if (username === this.bot.username) return;
      const target = this.bot.players[username].entity;
      if (message === 'come') {
        navigation.navigate(this.bot,target.position);
      }
      if(message==='hey')
        this.bot.lookAt(target.position);
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
  port: 2872
});
