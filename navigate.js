const aStar = require('./aStar');
const Vec3 = require('vec3');
const vecMid = v => v.floored().offset(0.5, 0, 0.5);
const isWater = b => b.type === 8 || b.type === 9;
const radians = [
  Math.PI * 2, //0 z-
  Math.PI / 4, //45 x-z-
  Math.PI / 2, //90 x-
  (3 * Math.PI) / 4, //135 x-z+
  Math.PI, //180 z+
  (5 * Math.PI) / 4, //225 x+z+
  (3 * Math.PI) / 2, //270 x+
  (7 * Math.PI) / 4, //315 x+z-
];
const directions = [Vec3(0, 0, -1), Vec3(-1, 0, 0), Vec3(0, 0, 1), Vec3(1, 0, 0)];
const EPSILON = 0.000001;
function Node(pos, action = 'move', yaw, forward, right, jump, onGround = true, falling, sprint, vel) {
  this.point = pos;
  this.yaw = yaw;
  this.forward = forward;
  this.right = right;
  this.jump = jump;
  this.onGround = onGround;
  this.falling = falling;
  this.sprint = sprint;
  this.vel = vel;
  this.action = action;
  this.toString = () => this.point.toString();
}
class Navigator {
  constructor(bot) {
    this.bot = bot;
    this.bot.navigate = this.navigate;
  }
  blocks = {};
  blockAt(p) {
    let block = this.blocks[p.x + '_' + p.y + '_' + p.z];
    if (!block) block = this.bot.blockAt(p);
    return block;
  }
  moveToPoint(node) {
    return new Promise((r, j) => {
      if (node.action) {
        // center player
        const p = vecMid(node.point);
        this.bot.entity.position = vecMid(this.bot.entity.position);
        const interval = setInterval(() => {
          // look at point
          const delta = p.minus(this.bot.entity.position);
          this.bot.look(Math.atan2(-delta.x, -delta.z), 0);
          // set controls
          this.bot.clearControlStates();
          if (node.action === 'move') {
            // is swimming
            if (
              isWater(this.bot.blockAt(this.bot.entity.position)) ||
              isWater(this.bot.blockAt(this.bot.entity.position.offset(0, 1, 0))) ||
              isWater(this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0)))
            ) {
              this.bot.entity.position.x += node.point.x > this.bot.entity.position.x ? 0.1 : -0.1;
              this.bot.entity.position.y += node.point.y > this.bot.entity.position.y ? 0.1 : -0.1;
              this.bot.entity.position.z += node.point.x > this.bot.entity.position.z ? 0.1 : -0.1;
            } else {
              this.bot.setControlState('forward', true);
              this.bot.setControlState('sprint', true);
              if (this.bot.onGround && Math.floor(this.bot.entity.position.y) < Math.floor(node.point.y))
                this.bot.setControlState('jump', true);
            }
          }
          if (this.bot.entity.position.distanceTo(p) < 0.2) {
            this.bot.clearControlStates();
            clearInterval(interval);
            r();
          }
        }, 50);
      } else
        setInterval(() => {
          bot.look(node.yaw, 0);
          this.bot.clearControlStates();
          if (node.forward === 1) this.bot.setControlState('forward', true);
          if (node.forward === -1) this.bot.setControlState('back', true);
          if (node.right === 1) this.bot.setControlState('right', true);
          if (node.right === -1) this.bot.setControlState('left', true);
          if (node.jump) this.bot.setControlState('jump', true);
          if (node.sprint) this.bot.setControlState('sprint', true);
          if (this.bot.entity.position.distanceTo(node.point) < 0.1) r();
          else
            console.log(`FUCKING ALARM IDK HOW PROGRAMMING WORKS
            ${this.bot.entity.position.distanceTo(node.point)} meters away`);
        }, 50);
    });
  }
  navigate = async p => {
    this.bot.physics.jumpSpeed = 10;
    const end = p.floored();
    const results = aStar({
      start: new Node(this.bot.entity.position.floored(), 'move', this.bot.entity.yaw),
      isEnd: node => node.point.distanceTo(end) <= 0.1,
      neighbor: node => this.getNeighborsUsingPhysics(node),
      distance: (a, b) => a.point.distanceTo(b.point),
      heuristic: node => node.point.distanceTo(end),
    });
    if (results.status === 'success') {
      for (const node of results.path) {
        await this.moveToPoint(node);
      }
    }
    console.log(results.status);
  };
  getBoundingBox = pos => ({
    min: new Vec3(pos.x - this.bot.physics.playerApothem, pos.y, pos.z - this.bot.physics.playerApothem).floor(),
    max: new Vec3(
      pos.x + this.bot.physics.playerApothem,
      pos.y + this.bot.physics.playerHeight,
      pos.z + this.bot.physics.playerApothem,
    ).floor(),
  });
  collisionInRange(boundingBoxMin, boundingBoxMax) {
    const cursor = new Vec3(0, 0, 0);
    let block;
    for (cursor.x = boundingBoxMin.x; cursor.x <= boundingBoxMax.x; cursor.x++) {
      for (cursor.y = boundingBoxMin.y; cursor.y <= boundingBoxMax.y; cursor.y++) {
        for (cursor.z = boundingBoxMin.z; cursor.z <= boundingBoxMax.z; cursor.z++) {
          block = this.blockAt(cursor);
          if (block && block.boundingBox === 'block') return true;
        }
      }
    }
    return false;
  }
  emulatePhysics(pos, yaw, forward, right, jump, onGround = true, falling = 0, sprint = true, vel = Vec3(0, 0, 0),debug) {
    for (let t = 1; t <= 1; t++) {
      // set acceleration to input
      const acceleration = new Vec3(0, 0, 0);
      if(debug) console.log(acceleration);
      if (forward || right) {
        const rotationFromInput = Math.atan2(-right, forward);
        const inputYaw = this.bot.entity.yaw + rotationFromInput;
        acceleration.x += this.bot.physics.walkingAcceleration * -Math.sin(inputYaw);
        acceleration.z += this.bot.physics.walkingAcceleration * -Math.cos(inputYaw);
        if (sprint && forward === 1) {
          acceleration.x *= this.bot.physics.sprintSpeed;
          acceleration.z *= this.bot.physics.sprintSpeed;
        }
      }
      if(debug) console.log(acceleration);
      acceleration.x += this.bot.physics.walkingAcceleration * -Math.sin(yaw);
      acceleration.z += this.bot.physics.walkingAcceleration * -Math.cos(yaw);
      if (sprint) {
        acceleration.x *= this.bot.physics.sprintSpeed;
        acceleration.z *= this.bot.physics.sprintSpeed;
      }
      if(debug) console.log(acceleration);
      if (jump && onGround) vel.y = this.bot.physics.jumpSpeed;
      acceleration.y -= this.bot.physics.gravity;
      if(debug) console.log(acceleration);
      // ground friction
      const oldGroundSpeedSquared = vel.x * vel.x + vel.z * vel.z;
      if (oldGroundSpeedSquared < EPSILON) {
        vel.x = 0;
        vel.z = 0;
      } else {
        const oldGroundSpeed = Math.sqrt(oldGroundSpeedSquared);
        let groundFriction = this.bot.physics.groundFriction * this.bot.physics.walkingAcceleration;
        if (!onGround) groundFriction *= 0.05;
        const maybeNewGroundFriction = oldGroundSpeed / 0.05;
        groundFriction = groundFriction > maybeNewGroundFriction ? maybeNewGroundFriction : groundFriction;
        acceleration.x -= (vel.x / oldGroundSpeed) * groundFriction;
        acceleration.z -= (vel.z / oldGroundSpeed) * groundFriction;
      }
      if(debug) console.log(acceleration);
      // acceleration to velocity
      vel.add(acceleration.scaled(0.05));
      // change velocity based on ground
      let currentMaxGroundSpeed;
      const underBlock = this.blockAt(pos.offset(0, -1, 0));
      const inBlock = this.blockAt(pos.offset(0, 0, 0));
      if (underBlock && underBlock.type === 88) currentMaxGroundSpeed = this.bot.physics.maxGroundSpeedSoulSand;
      else if (inBlock && inBlock.type === 9) currentMaxGroundSpeed = this.bot.physics.maxGroundSpeedWater;
      else currentMaxGroundSpeed = this.bot.physics.maxGroundSpeed;
      if (sprint) currentMaxGroundSpeed *= this.bot.physics.sprintSpeed;
      const groundSpeedSquared = vel.x * vel.x + vel.z * vel.z;
      if (groundSpeedSquared > currentMaxGroundSpeed * currentMaxGroundSpeed) {
        const groundSpeed = Math.sqrt(groundSpeedSquared);
        const correctionScale = currentMaxGroundSpeed / groundSpeed;
        vel.x *= correctionScale;
        vel.z *= correctionScale;
      }
      vel.y = Math.min(Math.max(vel.y, -this.bot.physics.terminalVelocity), this.bot.physics.terminalVelocity);
      // calculate new positions and resolve collisions
      let boundingBox = this.getBoundingBox(pos);
      let boundingBoxMin;
      let boundingBoxMax;
      if (vel.x !== 0) {
        pos.x += vel.x * 0.05;
        const blockX = Math.floor(pos.x + Math.sign(vel.x) * this.bot.physics.playerApothem);
        boundingBoxMin = new Vec3(blockX, boundingBox.min.y, boundingBox.min.z);
        boundingBoxMax = new Vec3(blockX, boundingBox.max.y, boundingBox.max.z);
        if (this.collisionInRange(boundingBoxMin, boundingBoxMax)) return false;
      }
      if (vel.z !== 0) {
        pos.z += vel.z * 0.05;
        const blockZ = Math.floor(pos.z + Math.sign(vel.z) * this.bot.physics.playerApothem);
        boundingBoxMin = new Vec3(boundingBox.min.x, boundingBox.min.y, blockZ);
        boundingBoxMax = new Vec3(boundingBox.max.x, boundingBox.max.y, blockZ);
        if (this.collisionInRange(boundingBoxMin, boundingBoxMax)) return false;
      }
      if (vel.y <= 0 && !onGround) falling += vel.y * 0.05;
      else falling = 0;
      onGround = false;
      if (vel.y !== 0) {
        pos.y += vel.y * 0.05;
        const playerHalfHeight = this.bot.physics.playerHeight / 2;
        const blockY = Math.floor(pos.y + playerHalfHeight + Math.sign(vel.y) * playerHalfHeight);
        boundingBoxMin = new Vec3(boundingBox.min.x, blockY, boundingBox.min.z);
        boundingBoxMax = new Vec3(boundingBox.max.x, blockY, boundingBox.max.z);
        if (this.collisionInRange(boundingBoxMin, boundingBoxMax)) {
          pos.y = blockY + (vel.y < 0 ? 1 : -this.bot.physics.playerHeight) * 1.001;
          if (falling > 3 && !isWater(this.blockAt(pos))) return false;
          onGround = true;
          vel.y = 0;
        }
      }
    }
    return {
      pos: pos,
      vel: vel,
      onGround: onGround,
      falling: falling,
    };
  }
  isSafePos(pos) {
    const block0 = this.blockAt(pos.offset(0, -1, 0));
    const block1 = this.blockAt(pos);
    const block2 = this.blockAt(pos.offset(0, 1, 0));
    if (block1.boundingBox === 'block' || block2.boundingBox === 'block') return false;
    if (isWater(block0) || isWater(block1) || isWater(block2)) return true;
    return block0.boundingBox === 'block';
  }
  getNeighborsUsingPhysics(node) {
    const results = [];
    let canJump;
    // if in water
    if (this.isSafePos(node.point.offset(0, 1, 0))) results.push({ pos: node.point.offset(0, 1, 0) });
    if (this.isSafePos(node.point.offset(0, -1, 0))) results.push({ pos: node.point.offset(0, -1, 0) });
    // if player on ground check cardinal directions
    if (node.onGround)
      for (let i = 0; i < directions.length; i++) {
        const checkDir = i => {
          const d = directions[i];
          const b = (y, m = 1) => node.point.offset(d.x * m, y, d.z * m);
          // if block at head height can do nothing
          if (this.blockAt(b(1)).boundingBox === 'block') return;
          // can walk forward
          if (this.isSafePos(b(0))) return results.push({ pos: b(0) });
          // can jump on block
          canJump = this.blockAt(node.point.offset(0, 2, 0)).boundingBox === 'empty';
          if (canJump && this.isSafePos(b(1))) return results.push({ pos: b(1) });
          // can jump off safely
          for (let hy = 1; hy <= 3; hy++) if (this.isSafePos(b(-hy))) return results.push({ pos: b(-hy) });
          if (this.isSafePos(b(-3, 2))) return results.push({ pos: b(-3, 2) });
          // start jump calculation if can do nothing
          if (canJump) {
            // check the jump only for this direction and the diagonal direction to the right
            [radians[i * 2], radians[i * 2 + 1]].forEach(r => {
              // emulate mineflayer physics
              let p = this.emulatePhysics(node.point, r, 1, 0, true, node.onGround, node.falling, true, node.vel);
              // if don't collide with anything on the x, z axis or take damage from falling
              if (p) results.push({ ...p, yaw: node.yaw, forward: 1, right: 0, jump: true, sprint: true });
            });
          }
        };
        checkDir(i);
      }
    //if player not on ground check every possible input for every tick
    else
      [
        [1, 0],
        [1, 1],
        [1, -1],
        [0, 1],
        [0, -1],
        [-1, 1],
        [-1, -1],
      ].forEach(o => {
        console.log('emulaTE')
        let p = this.emulatePhysics(
          node.point,
          node.yaw,
          o[0],
          o[1],
          false,
          node.onGround,
          node.falling,
          true,
          node.vel,
          true,
        );
        if (p) results.push({ ...p, yaw: node.yaw, forward: o[0], right: o[1], jump: false, sprint: true });
      });
    return results.map(
      el =>
        new Node(el.pos, el.action, el.yaw, el.forward, el.right, el.jump, el.onGround, el.falling, el.sprint, el.vel),
    );
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
    Vec3(-1, 0, 0), // north
    Vec3(1, 0, 0), // south
    Vec3(0, 0, -1), // east
    Vec3(0, 0, 1) // west
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
module.exports = Navigator;
