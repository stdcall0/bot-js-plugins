import plugin from '../../lib/plugins/plugin.js'

export class csgoreg extends plugin {
  constructor () {
    super({
      name: '报名',
      dsc: 'CS2报名',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message.group',
      priority: 5000,
      rule: [
        {
          reg: '^#报名$',
          fnc: 'reg_view'
        },
        {
          reg: '^(报名|[012345789])$',
          fnc: 'reg_it'
        },
        {
          reg: '^#报名(开始|start)$',
          fnc: 'reg_start'
        },
        {
          reg: '^#报名(结束|stop)$',
          fnc: 'reg_end'
        },
        {
          reg: '^#报名(重置|reset)$',
          fnc: 'reg_res'
        },
        {
          reg: '^#报名(取消|cancel)$',
          fnc: 'reg_cancel'
        },
      ]
    })
  }
  
  async onreg() {
    let t = await redis.get('cs:or')
    logger.info(t)
    if (t=='t') return true
    return false
  }
  async alreg() {
    let t = await redis.get('cs:ar')
    logger.info(t)
    if (t=='t') return true
    return false
  }
  async rlist() {
    let t = await redis.get('cs:rl')
    logger.info(t)
    let rl = t ? JSON.parse(t) : {}
    return rl
  }
  async ilist() {
    let t = await redis.get('cs:il')
    logger.info(t)
    let il = t ? JSON.parse(t) : {}
    return il
  }
  async Sonreg(r) {
    logger.info(r)
    redis.set('cs:or', r ? 't' : 'f')
  }
  async Salreg(r) {
    redis.set('cs:ar', r ? 't' : 'f')
  }
  async Srlist(r) {
    redis.set('cs:rl', JSON.stringify(r))
  }
  async Silist(r) {
    redis.set('cs:il', JSON.stringify(r))
  }

  async reg_start () {
    if (this.e.group.group_id != 866519018) return;
    this.Sonreg(true)
    this.Salreg(true)
    this.Srlist([])
    this.Silist([])
    this.reply('报名开始！\n回复任意数字即可参与报名。', false)
  }
  async reg_end () {
    if (this.e.group.group_id != 866519018) return;
    this.Salreg(false)
    await this.reply(`报名已截止！共有 ${(await this.ilist()).length} 人参与了报名。`, false)
  }
  async reg_res () {
    if (this.e.group.group_id != 866519018) return;
    let msg = '当前报名列表：'
    let rl = await this.rlist()
    for (let i = 0; i < rl.length; ++i) {
      msg += `\n#${i+1}. ${rl[i]}`
    }
    await this.reply(msg)
    this.Sonreg(true)
    this.Salreg(true)
    this.Srlist([])
    this.Silist([])
    await this.reply(`报名已重置！重置前已有 ${(await this.ilist()).length} 人参与了报名。`, false)
  }
  async reg_it(e) {
    if (this.e.group.group_id != 866519018) return;
    if (await this.alreg() != true) {
      return
    }
    let card = e.member.card
    let id = e.member.user_id
    let il = await this.ilist()
    let rl = await this.rlist()
    if (il.includes(id)) {
      await this.reply('你已经参加过报名，请勿重复报名！', true)
    } else {
      il.push(id)
      rl.push(card)
      this.Silist(il)
      this.Srlist(rl)
      await this.reply(`#${il.length} <${card}> 报名成功！`, true)
    }
  }

  async reg_view() {
    if (this.e.group.group_id != 866519018) return;
    if (!await this.onreg()) {
      this.reply('当前没有活动的报名，回复 #报名开始 可初始化报名！')
    } else {
      let msg = '当前报名列表：'
      let rl = await this.rlist()
      for (let i = 0; i < rl.length; ++i) {
        msg += `\n#${i+1}. ${rl[i]}`
      }
      await this.reply(msg)
    }
  }
  
  async reg_cancel(e) {
    if (this.e.group.group_id != 866519018) return;
    if (!await this.alreg()) {
      return;
    }
    let id = e.member.user_id;
    let il = await this.ilist();
    let rl = await this.rlist();
    let index = il.indexOf(id); // 找到参与者在 il 数组中的索引
    if (index !== -1) {
      il.splice(index, 1); // 从 il 数组中移除参与者
      rl.splice(index, 1); // 从 rl 数组中移除对应的名字
      this.Silist(il);
      this.Srlist(rl);
      await this.reply('你已取消报名。', true);
    } else {
      await this.reply('你并未参加报名，无法取消。', true);
    }
  }
}