import plugin from '../../lib/plugins/plugin.js'
import common from '../../lib/common/common.js'
import fetch from 'node-fetch'
import lodash from 'lodash'
import fs from 'fs'
import YAML from 'yaml'

let tmp

export class DailyTask extends plugin {
  constructor () {
    super({
      /** 功能名称 */
      name: '查询委托成就',
      /** 功能描述 */
      dsc: '查询每日委托任务有没有成就',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      /** 优先级，数字越小等级越高 */
      priority: 5000,
      rule: [{
          /** 命令正则匹配 */
          reg: '^---查委托---$',
          /** 执行方法 */
          fnc: 'dailyTask'
        },
        {
          /** 命令正则匹配 */
          reg: '^#*(设置|配置)?(.+)(别称|别名)$',
          /** 执行方法 */
          fnc: 'Abbr'
        },
        {
          /** 命令正则匹配 */
          reg: '^#*(修改|设置|配置|删除|移除)(.+)文案$',
          /** 执行方法 */
          fnc: 'Msg',
          /** 权限 master,owner,admin,all */
          permission: 'master'
        },
        {
          /** 命令正则匹配 */
          reg: '^#*(添加|修改)委托成就$',
          /** 执行方法 */
          fnc: 'Add'
        }
      ]
    })
    /** 定时任务 */
    this.task = {
      cron: '0 0 0/3 * * ?',
      name: '更新成就文案',
      fnc: () => this.init()
    }
  }

  /**
   * ---查委托---
   * 插件复制到 Yunzai-Bot/plugins/example/ 目录下
   * 首次使用需要重启机器人下载两个yaml文件
   * 全成就文档：docs.qq.com/doc/DS01hbnZwZm5KVnBB
   * 指令：#岩游记|#帝君故事|#修改《岩游记》文案|#删除《岩游记》文案|#岩游记别称|#设置岩游记别称
   * 联系QQ: 1146638442
   * https://hlhs-nb.cn/DailyTask/item
   */

  /** 插件初始化 */
  init () {
    let file = './data/dailyTask/'
    if (!fs.existsSync(file)) {
      fs.mkdirSync(file)
    }

    ['委托成就', '委托名字'].forEach(async v => {
      let res = await fetch(`https://hlhs-nb.cn/download/${v}`)
      if (res.ok) fs.writeFileSync(`${file}${v}.yaml`, await res.text())
    })
    tmp = this.read('委托成就')
  }

  set Data (msg) {
    let list = new Map()
    let res = this.read('委托名字')
    let defin = this.read('自定义别称') || {}

    /** 正则替换 */
    let reg = new RegExp('#|＃|？|。|,|，|·|!|！|—|《|》|…|「|」|『|』|、|\\.|\\?', 'g')
    msg = msg.replace(reg, '')

    lodash.forEach(res, (v, k) => {
      if (defin[k]) v.push(...defin[k])
      v.forEach((val) => {
        list.set(val, k)
      })
    })

    this.Name = list.get(msg.trim())
  }

  /** 获取内容 */
  get Data () {
    let defin = this.read('自定义文案') || []
    let data = defin.find(v => v.name == this.Name)

    if (!data) {
      tmp = tmp || this.read('委托成就')
      data = tmp.find(v => v.name == this.Name)
    }

    if (['蒙德委托', '璃月委托', '稻妻委托', '须弥委托', '枫丹委托'].includes(this.Name)) {
      let msg = `${this.Name}，无成就。`
      return msg
    }

    return data
  }

  /** 消息中间件 */
  accept () {
    if (!this.e.msg || this.e.img) return
    this.Data = this.e.msg
    if (this.Data) {
      this.e.msg = '---查委托---'
    }
  }

  /** 发送合并转发消息 */
  async dailyTask () {
    let data = this.Data
    if (typeof data == 'string') {
      await this.reply(data)
      return
    }
    let title = `${data.hidden && '隐藏' || ''}成就《${data.name}》\n${data.desc}`
    let item = new Array()
    data.involve.forEach((v) => {
      item.push(`${v.type.replace('委托任务', '每日委托')}《${v.task}》`)
    })
    let by = '\n————————\n※ 文案: B站 oz水银'
    let msg = await common.makeForwardMsg(this.e, [title, item.join('\n'), [...data.msg, by]], title)
    await this.reply(msg)
  }

  /** 别名 */
  async Abbr () {
    this.Data = this.e.msg.replace(new RegExp('设置|配置|别称|别名', 'g'), '')
    if (!this.Name) return false
    let name = this.Name

    if (/设置|配置/.test(this.e.msg)) {
      /** 设置别名权限 主人isMaster，群主is_owner，管理is_admin */
      if (!this.e.isMaster) return
      await this.reply(`请发送《${this.Name}》别名，多个用空格隔开`)
      this.e._name = name
      this.setContext('setAbbr')
      return true
    }

    let res = this.read('委托名字')
    let defin = this.read('自定义别称') || {}

    let ret = res[name]
    if (defin[name]) ret.push(...defin[name])

    let msg = `委托成就《${name}》别称，${ret.length}个`
    msg = await common.makeForwardMsg(this.e, [msg, ret.join('\n')], msg)

    await this.reply(msg)
  }

  async setAbbr () {
    if (!this.e.msg || this.e.at || this.e.img) {
      await this.reply('设置失败：请发送正确内容')
      return
    }

    let { setAbbr = {} } = this.getContext()
    this.finish('setAbbr')

    let name = setAbbr._name
    let item = this.e.msg.split(' ')

    let res = this.read('委托名字')
    let defin = this.read('自定义别称') || {}
    if (!defin[name]) defin[name] = []

    let ret = []
    for (let v of item) {
      if (!v) continue
      /** 重复添加 */
      if (res[name].includes(v)) continue
      if (defin[name].includes(v)) continue

      defin[name].push(v)
      ret.push(v)
    }
    if (ret.length <= 0) {
      await this.reply('设置失败：别名错误或已存在')
      return
    }
    this.write('自定义别称', defin)
    await this.reply(`设置别名成功：${ret.join('、')}`)
  }

  /** 文案 */
  async Msg () {
    this.Data = this.e.msg.replace(new RegExp('修改|设置|配置|删除|移除|成就|委托|文案', 'g'), '')
    if (!this.Data || typeof this.Data !== 'object') return false
    this.e._data = this.Data
    this.e._name = this.Name

    if (/修改|设置|配置/.test(this.e.msg)) {
      await this.reply('请发送内容')
      this.setContext('setMsg')
    } else if (/删除|移除/.test(this.e.msg)) {
      this.e.msg = '删除文案'
      this.getContext = () => {
        return { setMsg: this.e }
      }
      await this.setMsg()
    }
  }

  async setMsg () {
    if (!this.e.msg && !this.e.img || this.e.at) {
      await this.reply('操作失败：请发送正确内容')
      return
    }

    let { setMsg = {} } = this.getContext()

    let name = setMsg._name

    let data = setMsg._data
    data.msg = this.e.message

    let defin = this.read('自定义文案') || []
    let arr = defin.filter(v => v.name !== name)

    let msg = `委托成就《${name}》文案设置成功！`
    if (setMsg.msg == '删除文案') {
      msg = `委托成就《${name}》自定义文案已删除！`
      if (!defin.find(v => v.name == name)) {
        msg = `删除失败: 委托成就《${name}》自定义文案不存在！`
      }
    } else {
      arr.push(data)
      this.finish('setMsg')
    }

    await this.reply(msg)

    this.write('自定义文案', arr)
  }

  /** 攻略群添加成就 */
  Add () {
    this.e.reply('https://hlhs-nb.cn/DailyTask/item?%E6%B7%BB%E5%8A%A0%E5%A7%94%E6%89%98%E6%88%90%E5%B0%B1')
  }

  /** 读取文件 */
  read (name) {
    try {
      return YAML.parse(fs.readFileSync(`./data/dailyTask/${name}.yaml`, 'utf8'))
    } catch (err) {
      return false
    }
  }

  /** 写入文件 */
  write (name, data) {
    fs.writeFileSync(`./data/dailyTask/${name}.yaml`, YAML.stringify(data))
  }
}