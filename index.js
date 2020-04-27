const mineflayer = require('mineflayer');
const navigation = require('./navigation');
const getTps = require('./getTps');
const vec3 = require('vec3');
class bot {
  static list=[];
  constructor(options) {
    this.bot=mineflayer.createBot(options);
    this.id=bot.list.length;
    this.bot.on('chat', (username, message)=>{
      if (username === this.bot.username) return;
      const target = this.bot.players[username].entity;
      if (message === 'come') navigation.navigate(this.bot,target.position);
      if(message==='hey')
        this.bot.lookAt(target.position);
    });
  }
  tps = null;
  lastPosition=vec3(0,0,0);
  everySec =  setInterval(async ()=>{
    const oldtps = this.tps;
    this.tps = await getTps(this.bot);
    if(!oldtps&&this.tps) {
      console.log('connected!');
      this.bot.physics.jumpSpeed=10;
      console.log(this.bot.physics);
      this.everyTick = setInterval(()=>{
        let p = this.bot.entity.position.floored();
        if(!this.lastPosition.equals(p)) {
          this.lastPosition=p;
          const b = this.bot.blockAt(p);
          if(b.type===8||b.type===9) this.bot.physics.gravity=0;
          else this.bot.physics.gravity=27;
        }
      },50)
    }
    if(this.tps&&this.tps!==oldtps) {
      console.log(`tps: ${this.tps}`);
    }
  },1000);
}
const skyBot = new bot({
  username: 'SkyBot',
  host: 'localhost',
  port: 5116
});
