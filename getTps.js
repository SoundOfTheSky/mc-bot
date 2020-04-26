module.exports=async bot=>{
  return new Promise((r,j)=>{
    let time = parseInt(bot.time.age);
    setTimeout(() => {
      r(parseInt(bot.time.age) - time);
    }, 1000)
  });
}
