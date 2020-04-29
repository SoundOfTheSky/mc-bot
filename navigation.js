const aStar = require('./aStar');
const vec3 = require('vec3');
function Node(pos,yaw,forward,right,jump,onGround=true,sprint=true,vel=vec3(0,0,0)) {
  this.point=pos;
  this.yaw=yaw;
  this.forward=forward;
  this.right=right;
  this.jump=jump;
  this.onGround=onGround;
  this.sprint=sprint;
  this.vel=vel;
  this.toString = ()=>this.point.x+'_'+this.point.y+'_'+this.point.z;
}
const vecMid = v=>v.floored().offset(.5,0,.5);
const isWater = b => b.type===8||b.type===9;
const EPSILON = 0.000001;
class Navigator {
  constructor(bot) {
    this.bot=bot;
  }
  blocksToAvoid=[];
  blocks={};
  blockAt(p) {
    let block=this.blocks[p.x+'_'+p.y+'_'+p.z];
    if(!block) block=this.bot.blockAt(p);
    return block;
  }
  moveToPoint(p,sprint=true, jump=false, longjump=false,swim=false) {
    this.bot.entity.position=vecMid(this.bot.entity.position);
    return new Promise((r,j)=>{
      const interval = setInterval(()=>{
        // FIX LOOK
        this.bot.lookAt(vec3(p.x+0.5,bot.entity.position.y+1.9,p.z+0.5));
        if(longjump&&this.bot.entity.position.distanceTo(vecMid(bot.entity.position.floored()))>0.4) this.bot.setControlState('jump', true);
        if(jump) this.bot.setControlState('jump', true);
        if(swim) {
          this.bot.entity.position.x +=p.x > this.bot.entity.position.x?0.1:-0.1;
          this.bot.entity.position.y +=p.y > this.bot.entity.position.y?0.1:-0.1;
          this.bot.entity.position.z +=p.x > this.bot.entity.position.z?0.1:-0.1;
        }
        if(this.bot.entity.position.distanceTo(vecMid(p))<0.2) {
          clearInterval(interval);
          this.bot.setControlState('forward', false);
          this.bot.setControlState('sprint', false);
          this.bot.setControlState('jump', false);
          r();
        }
      },50);
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);
    });
  }
  navigate = async (p, options={})=>{
    this.bot.physics.jumpSpeed=10;
    const end = p.floored();
    const results = aStar({
      start: new Node(this.bot.entity.position.floored(), 'walk'),
      isEnd: node=>node.point.distanceTo(end) <= 0.1,
      neighbor: node=>this.getNeighbors(node,bot),
      distance: (a,b)=>a.point.distanceTo(b.point),
      heuristic: node=>node.point.distanceTo(end)
    });
    if(results.status==='success') {
      for(const node of results.path) {
        await this.moveToPoint(bot,node.point,false,node.action==='jump', node.action==='longjump', node.action==='swim');
      }
    }
    console.log(results.status);
  }
  getBoundingBox = pos=>({
    min: new Vec3(
        pos.x - this.bot.physics.playerApothem,
        pos.y,
        pos.z - this.bot.physics.playerApothem
    ).floor(),
    max: new Vec3(
        pos.x + this.bot.physics.playerApothem,
        pos.y + this.bot.physics.playerHeight,
        pos.z + this.bot.physics.playerApothem
    ).floor()
  });
  collisionInRange (boundingBoxMin, boundingBoxMax) {
    const cursor = new Vec3(0, 0, 0)
    let block
    for (cursor.x = boundingBoxMin.x; cursor.x <= boundingBoxMax.x; cursor.x++) {
      for (cursor.y = boundingBoxMin.y; cursor.y <= boundingBoxMax.y; cursor.y++) {
        for (cursor.z = boundingBoxMin.z; cursor.z <= boundingBoxMax.z; cursor.z++) {
          block = this.blockAt(cursor);
          if (block && block.boundingBox === 'block') return true
        }
      }
    }
    return false
  }
  emulatePhysics(pos,yaw,forward,right,jump,onGround=true,sprint=true,vel=vec3(0,0,0)) {
    onGround=onGround?onGround:bot.entity.onGround;
    pos=pos?pos:bot.entity.position.clone();
    yaw=yaw?yaw:bot.entity.yaw;
    for(let t=1;t<=1;t++) {
      // set acceleration to input
      const acceleration = new Vec3(0, 0, 0);
      if (forward || right) {
        const rotationFromInput = Math.atan2(-right, forward)
        const inputYaw = this.bot.entity.yaw + rotationFromInput
        acceleration.x += this.bot.physics.walkingAcceleration * -Math.sin(inputYaw)
        acceleration.z += this.bot.physics.walkingAcceleration * -Math.cos(inputYaw)
        if (sprint) {
          acceleration.x *= this.bot.physics.sprintSpeed
          acceleration.z *= this.bot.physics.sprintSpeed
        }
      }
      acceleration.x += this.bot.physics.walkingAcceleration * -Math.sin(yaw);
      acceleration.z += this.bot.physics.walkingAcceleration * -Math.cos(yaw);
      if (sprint) {
        acceleration.x *= this.bot.physics.sprintSpeed
        acceleration.z *= this.bot.physics.sprintSpeed
      }
      if (jump&&onGround) vel.y = this.bot.physics.jumpSpeed;
      acceleration.y -= this.bot.physics.gravity;
      // ground friction
      const oldGroundSpeedSquared = vel.x * vel.x + vel.z * vel.z;
      if (oldGroundSpeedSquared < EPSILON) {
        vel.x = 0
        vel.z = 0
      } else {
        const oldGroundSpeed = Math.sqrt(oldGroundSpeedSquared)
        let groundFriction = this.bot.physics.groundFriction * this.bot.physics.walkingAcceleration
        if (!onGround) groundFriction *= 0.05
        const maybeNewGroundFriction = oldGroundSpeed / 0.05;
        groundFriction = groundFriction > maybeNewGroundFriction ? maybeNewGroundFriction : groundFriction;
        acceleration.x -= vel.x / oldGroundSpeed * groundFriction;
        acceleration.z -= vel.z / oldGroundSpeed * groundFriction;
      }
      // acceleration to velocity
      vel.add(acceleration.scaled(0.05));
      // change velocity based on ground
      let currentMaxGroundSpeed;
      const underBlock = this.blockAt(pos.offset(0, -1, 0))
      const inBlock = this.blockAt(pos.offset(0, 0, 0))
      if (underBlock && underBlock.type === 88) currentMaxGroundSpeed = this.bot.physics.maxGroundSpeedSoulSand
      else if (inBlock && inBlock.type === 9) currentMaxGroundSpeed = this.bot.physics.maxGroundSpeedWater;
      else currentMaxGroundSpeed = this.bot.physics.maxGroundSpeed;
      if (sprint) currentMaxGroundSpeed *= this.bot.physics.sprintSpeed;
      const groundSpeedSquared = vel.x * vel.x + vel.z * vel.z;
      if (groundSpeedSquared > currentMaxGroundSpeed * currentMaxGroundSpeed) {
        const groundSpeed = Math.sqrt(groundSpeedSquared)
        const correctionScale = currentMaxGroundSpeed / groundSpeed
        vel.x *= correctionScale
        vel.z *= correctionScale
      }
      vel.y = Math.clamp(-bot.physics.terminalVelocity, vel.y, bot.physics.terminalVelocity)
      // calculate new positions and resolve collisions
      let boundingBox = this.getBoundingBox(pos);
      let boundingBoxMin;
      let boundingBoxMax;
      if (vel.x !== 0) {
        pos.x += vel.x * 0.05;
        const blockX = Math.floor(pos.x + Math.sign(vel.x) * this.bot.physics.playerApothem)
        boundingBoxMin = new Vec3(blockX, boundingBox.min.y, boundingBox.min.z)
        boundingBoxMax = new Vec3(blockX, boundingBox.max.y, boundingBox.max.z)
        if (this.collisionInRange(boundingBoxMin, boundingBoxMax)) {
          pos.x = blockX + (vel.x < 0 ? 1 + this.bot.physics.playerApothem : -this.bot.physics.playerApothem) * 1.001;
          vel.x = 0;
          boundingBox = this.getBoundingBox(pos);
        }
      }
      if (vel.z !== 0) {
        pos.z += vel.z * 0.05;
        const blockZ = Math.floor(pos.z + Math.sign(vel.z) * this.bot.physics.playerApothem)
        boundingBoxMin = new Vec3(boundingBox.min.x, boundingBox.min.y, blockZ)
        boundingBoxMax = new Vec3(boundingBox.max.x, boundingBox.max.y, blockZ)
        if (this.collisionInRange(boundingBoxMin, boundingBoxMax)) {
          pos.z = blockZ + (vel.z < 0 ? 1 + this.bot.physics.playerApothem : -this.bot.physics.playerApothem) * 1.001
          vel.z = 0
          boundingBox = this.getBoundingBox(pos)
        }
      }
      onGround = false
      if (vel.y !== 0) {
        pos.y += vel.y * 0.05
        const playerHalfHeight = bot.physics.playerHeight / 2
        const blockY = Math.floor(pos.y + playerHalfHeight + Math.sign(vel.y) * playerHalfHeight)
        boundingBoxMin = new Vec3(boundingBox.min.x, blockY, boundingBox.min.z)
        boundingBoxMax = new Vec3(boundingBox.max.x, blockY, boundingBox.max.z)
        if (this.collisionInRange(boundingBoxMin, boundingBoxMax)) {
          pos.y = blockY + (vel.y < 0 ? 1 : -this.bot.physics.playerHeight) * 1.001
          onGround = vel.y < 0;
          vel.y = 0
        }
      }
    }
    return {
      pos: pos,
      vel: vel,
      onGround: onGround
    }
  }
  radians=[
    Math.PI*2,//0
    Math.PI/4,//45
    Math.PI/2,//90
    3*Math.PI/4,//135
    Math.PI,//180
    5*Math.PI/4,//225
    3*Math.PI/2,//270
    7*Math.PI/4,//315
  ]
  getNeighborsUsingPhysics(node) {
    const neighbors =[];
    this.radians.forEach(r=>{

    });
    return result.map(el=>new Node(el.p, el.a));
  }
}
/*function getNeighbors(node,bot) {
  const getBlock = p=>blockAt(bot,p);
  blocks={};
  const point = node.point
  const result = [];
  const isFloor = b=>b.boundingBox==='block'||isWater(b);
  function getSafeFloor(x,z) {
    for(let y=-1; y<point.y; y++) {
      const b=getBlock(point.offset(x,-y,z))
      if(b.boundingBox==='block') return result.push({p:point.offset(x,-y+1,z),a:'walk'});
    }
  }
  function safePos(p) {
    const b0=getBlock(p);
    const b1=getBlock(p.offset(0,1,0));
    if(isWater(b0)||isWater(b1)) return true;
    return isFloor(getBlock(p.offset(0,-1,0)));
  }
  // up or down
  [-1,1].forEach(dv=>{
    const block0 = getBlock(point.offset(0,dv,0));
    if(block0.type===8||block0.type===9) return result.push({p:point.offset(0,dv,0), a:'swim'});
  });
  // simple directions
  [
    vec3(-1, 0, 0), // north
    vec3(1, 0, 0), // south
    vec3(0, 0, -1), // east
    vec3(0, 0, 1) // west
  ]
    .forEach(dv=>{
    if(getBlock(point.offset(dv.x,1,dv.z)).boundingBox==='block') return;
    if(getBlock(point.offset(dv.x,0,dv.z)).boundingBox==='block') {
      if(getBlock(point.offset(0, 2, 0)).boundingBox==='block') return;
      if(getBlock(point.offset(dv.x, 2, dv.z)).boundingBox==='block') return;
      return result.push({p:point.offset(dv.x,1,dv.z),a:'jump'});
    }
    if(isWater(getBlock(point))||isWater(getBlock(point.offset(0,1,0)))) {
      if(getBlock(point.offset(0,2,0)).boundingBox==='empty') result.push({p:point.offset(0,1,0),a:'swim'});
      if(getBlock(point.offset(0,-1,0)).boundingBox==='empty') result.push({p:point.offset(0,-1,0),a:'swim'});
      //CHECK FALL IF BELOW
      //result.push({p:point.offset(dv.x,0,dv.z),a:'swim'});
      //DONT LET LONGJUMP
    }
    if(getBlock(point.offset(dv.x,-1,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,0,dv.z),a:'walk'});
    if(getBlock(point.offset(dv.x,-2,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,-1,dv.z),a:'walk'});
    if(getBlock(point.offset(dv.x,-3,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,-2,dv.z),a:'walk'});
    if(getBlock(point.offset(dv.x,-4,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,-3,dv.z),a:'walk'});


    const maxHeight=point.y+1;
    for(let i=1; i<jumpHeights.length;i++) {
      const j = jumpHeights[i];
      const h=maxHeight-point.offset(0,j,0).y;
      if(getBlock(point.offset(dv.x*i,j,dv.z*i)).boundingBox==='empty') {
        if (getBlock(point.offset(dv.x*i, j + 1, dv.z*i)).boundingBox === 'empty' && getBlock(point.offset(dv.x*i, j - 1, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j, dv.z*i),a:'longjump'});
        if (h<=3&&getBlock(point.offset(dv.x*i, j - 1, dv.z*i)).boundingBox === 'empty' && getBlock(point.offset(dv.x*i, j - 2, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j - 1, dv.z*i),a:'longjump'});
      }
      if(getBlock(point.offset(dv.x*i,j-2,dv.z*i)).boundingBox==='empty') {
        if(h<=2&&getBlock(point.offset(dv.x*i, j - 1, dv.z*i)).boundingBox === 'empty'&& getBlock(point.offset(dv.x*i, j - 3, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j - 2, dv.z*i),a:'longjump'});
        if(h<=1&&getBlock(point.offset(dv.x*i, j - 3, dv.z*i)).boundingBox === 'empty'&& getBlock(point.offset(dv.x*i, j - 4, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j - 3, dv.z*i),a:'longjump'});
      }
    }
  });
  // longjump
  for(const yaw of [1]) {
    const p = emulatePhysics(bot,yaw);

    if(safePos(p)) result.push({p:p,a:'longjump'});
  }
  return result.map(el=>new Node(el.p, el.a));
}*/
module.exports = {
  navigate: navigate
}
