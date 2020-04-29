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
  lastPosition=vec3(0,0,0);
  everySec =  setInterval(async ()=>{},1000);
  everyTick = setInterval(()=>{
    if(!this.bot.entity) return;
    this.bot.look(Math.PI, 0);
    this.bot.setControlState('forward', true);
    //console.log(this.bot.physics.walkingAcceleration+'_'+this.bot.physics.sprintSpeed);
    //console.log(((this.bot.physics.walkingAcceleration * -Math.sin(this.bot.entity.yaw)*this.bot.physics.sprintSpeed)/20) + '_'+(this.bot.physics.walkingAcceleration * -Math.cos(this.bot.entity.yaw)*this.bot.physics.sprintSpeed/20))
    let p = this.bot.entity.position.floored();
    if(!this.lastPosition.equals(p)) {
      this.lastPosition=p;
      const b = this.bot.blockAt(p);
      if(!b) return;
      if(b.type===8||b.type===9) this.bot.physics.gravity=0;
      else this.bot.physics.gravity=27;
    }
  },50)
}
const skyBot = new bot({
  username: 'SkyBot',
  host: 'localhost',
  port: 6324
});
