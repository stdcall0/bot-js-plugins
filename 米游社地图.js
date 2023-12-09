// https://gitee.com/little-flower-flower/yzjs/blob/master/%E7%B1%B3%E6%B8%B8%E7%A4%BE%E5%9C%B0%E5%9B%BE.js

//作者QQ1146638442
//资源包项目地址https://gitee.com/QQ1146638442/mys_map
//更新日志资源接口请求失败调用本地图片&发送原图可直接在qq查看原图
import plugin from '../../lib/plugins/plugin.js'
import common from '../../lib/common/common.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import { exec } from 'child_process'
import fetch from 'node-fetch'
import fs from 'fs'
import YAML from 'yaml'
import moment from 'moment'
const _path = process.cwd()
const bc = `${_path}/resources/MysMap`;

let ing = false
let alias = {}
let cd = {}
export class Mys_Map extends plugin {
  constructor () {
    super({
      name: '大地图找资源',
      dsc: '找资源',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: -3000,
      rule: [
        {
          // reg: '^#*((提瓦特|渊下宫|层岩巨渊|地下矿区)?((哪有|哪里有)(.+))|((.+)(在哪|在哪里|哪有|哪里有|位置|点位))(？)?)$',
          reg: '^#((提瓦特|渊下宫|层岩巨渊|地下矿区)?((哪有|哪里有)(.+))|((.+)(在哪|在哪里|哪有|哪里有|位置|点位))(？)?)$',
          fnc: 'mys_map'
        },
        {
          reg: '^#(原神|米游社)?(地图)?资源列表$',
          fnc: 'map_label'
        },
        {
          reg: '^#(地图|找资源)帮助$',
          fnc: 'map_help'
        },
        {
          reg: '^#(.*)[0-9a-zA-Z]{2}$',
          fnc: 'map_label_info',
          log: false
        },
        {
          reg: '^#初始化地图资源$',
          fnc: 'map_init',
          permission: 'master'
        }
      ]
    })
    /** 定时任务 */
    this.task = {
      cron: '0 0 0/3 * * ?',
      name: '更新米游社大地图资源',
      fnc: () => this.init()
    }
    this.path = './resources/MysMap'
    this.url = 'https://hlhs-nb.cn'
  }

  async init () {
    if (!fs.existsSync(this.path)) return
    if (!fs.existsSync(`${this.path}/icon`)) fs.mkdirSync(`${this.path}/icon`)
    await common.downFile('https://api-static.mihoyo.com/common/map_user/ys_obc/v1/map/label/tree?map_id=2&app_sn=ys_obc&lang=zh-cn', `${this.path}/label.json`)
    let tree = this.read(`${this.path}/label.json`)?.data?.tree
    if (!tree) return
    let data = this.read(`${bc}/资源别称.yaml`, true) || {}
    tree.forEach(val => {
      val.children.forEach(async v => {
        if (!data[v.id]) data[v.id] = [v.name]
        if (!fs.existsSync(`${this.path}/icon/${v.id}.png`)) {
          await common.downFile(v.icon, `${this.path}/icon/${v.id}.png`)
        }
      })
    })
    this.write(`${bc}/资源别称.yaml`, data, true)
  }

  async mys_map (e) {
    if (!fs.existsSync(`${this.path}/提瓦特`)) {
      await e.reply('尚未安装地图资源包\n请先【#初始化地图资源】')
      return
    } else {
      let files = fs.readdirSync(`${this.path}/提瓦特`)
      if (files.length < 300) {
        await e.reply('尚未安装地图资源包\n请先【#初始化地图资源】')
        return
      }
    }

    let reg = new RegExp('＃|#|更新|提瓦特|渊下宫|层岩巨渊|地下矿区|在|哪|里|有|位置|点位|？|\\?', 'g')
    let msg = e.msg.replace(reg, '')
    if (!msg) return false

    let label = await this.map_label(e, msg)
    if (!label) label = { name: msg, id: null }

    let map_id = '2', map_name = '提瓦特'
    if (e.msg.includes('渊下')) {
      map_id = '7', map_name = '渊下宫'
    } else if (e.msg.includes('层岩') || e.msg.includes('矿区')) {
      map_id = '9', map_name = '层岩巨渊'
    }

    let file = `${this.path}/${map_name}/${label.id}`
    let res, data = this.read(`${file}.json`)

    try {
      res = await (await fetch(`${this.url}/api/genshin/map?label_id=${label.id}&map_id=${map_id}`)).json()

      if (res.status == 0) {
        await this.reply(`${map_name}没有找到 ${label.name}，\n可能米游社wiki未更新或不存在该资源\n发送【#地图资源列表】查看所有资源名称`)
        return
      }
      if (res.status !== 1) {
        await this.reply('资源查询失败: 未知错误')
        return
      }

      if (data.timestamp < res.data.timestamp || e.msg.includes('更新')) {
        await e.reply(`「${label.name}」资源更新中...请耐心等待5-30s`)
        await common.downFile(this.url + res.data.image, `${file}.jpg`)
        this.write(`${file}.json`, res.data)
      }
    } catch (error) {
      res = { data }
      logger.error('[米游社地图] 源站资源请求失败~')
    }

    return await this.reply([
       `资源 ${label.name} 的位置如下`,
      { origin: true, ...segment.image(`${file}.jpg`) },
      `\n※ ${label.name} 一共找到 ${res.data.label_total} 个位置点\\n※ xx为资源点序号 来源:米游社大地图\n※ 可使用${label.name}xx查询该资源点详细位置\n※ 发送【地图帮助】查看地图资源位置说明`
    ])
  }

  /** 资源名称 */
  async map_label (e, label_name) {
    if (label_name) {
      let label = this.read(`${bc}/资源别称.yaml`, true) || {}
      let name = label[label_name]
      if (name) return { name: name[0], id: label_name }
      for (let i in label) {
        if (label[i].includes(label_name)) return { name: label[i][0], id: i }
      }
    } else {
      let tree = this.read(`${this.path}/label.json`)?.data?.tree
      let _data = []
      let data = []
      let list = ['传送点', '地标', '贵重收集物', '露天宝箱', '解谜宝箱', '区域特产', '背包/素材']
      let discard = ['指引']
      for (let val of tree) {
        if (discard.includes(val.name) || val.children.length < 1) continue
        let item = { title: val.name, list: [] }
        val.children.forEach(v => {
          if (v.name.length > 5) v.name = `${v.name.slice(0, 5)}…`
          item.list.push({
            name: `#${v.id}<br><span>${v.name}</span>`,
            icon: process.cwd() + `/resources/MysMap/icon/${v.id}.png`
          })
        })
        if (!list.includes(val.name)) {
          _data.push(item)
          continue
        }
        data.push(item)
      }
      await this.reply([await this.render({ data }), await this.render({ data: _data })])
    }
  }

  
  async map_label_info (e) {
    if (!e.msg || e.img) return false
    let msg = e.msg.replace(/＃|#|提瓦特|渊下宫|层岩巨渊|地下矿区/g, '')
    let map_id = 2, map_name = '提瓦特', key
    if (e.msg.includes('渊下')) {
      map_id = 7, map_name = '渊下宫'
    } else if (e.msg.includes('层岩') || e.msg.includes('矿区')) {
      map_id = 9, map_name = '层岩巨渊'
    }

    let keyRet = /[0-9a-zA-Z]{2}$/.exec(msg)
    if (keyRet) {
      key = keyRet[0]
      msg = msg.replace(keyRet[0], '').trim()
    }

    if (!msg || Number(msg)) return false
    let label = await this.map_label(e, msg)
    if (!label) return false

    let file = `${this.path}/${map_name}/${label.id}.json`
    if (!fs.existsSync(file)) {
      await e.reply(`${map_name}没有找到资源「${label.name}」`)
      return
    }
    let data = this.read(file)
    if (!data.info[key]) {
      await e.reply(`资源「${label.name}」没有找到「${key}」标点`)
      return
    }
    let url = `https://api-static.mihoyo.com/common/map_user/ys_obc/v1/map/point/info?map_id=${map_id}&point_id=${data.info[key]}&app_sn=ys_obc&lang=zh-cn`
    let res = await fetch(url)
    res = await res.json()
    let info = [`资源「${label.name + key}」描述信息：\n`]
    if (res.data && res.data.info) {
      if (res.data.info.content) info.push(res.data.info.content)
      if (res.data.info.img) info.push(segment.image(res.data.info.img))
      if (info.length < 2) {
        await e.reply(`资源「${label.name + key}」暂无描述`)
        return
      }
      await e.reply(info)
    }
  }

  async map_init(e) {
    if (fs.existsSync(`${this.path}/提瓦特`)) {
      let files = fs.readdirSync(`${this.path}/提瓦特`)
      if (files.length > 600) {
        await e.reply('地图资源已安装')
        return
      }
    }
    if (ing) {
      await e.reply('地图资源安装中...')
      return
    }
    if (fs.existsSync(this.path)) {
      fs.rmdirSync(this.path)
    }
    let command = `git clone https://gitee.com/QQ1146638442/mys_map.git "${process.cwd()}/resources/MysMap/" --depth=1`
    e.reply('开始初始化地图资源，请耐心等待~')
    ing = true
    exec(command, (err) => {
      if (err) {
        e.reply(`地图资源安装失败！\nError code: ${err.code}\n${err.stack}\n 请稍后重试。`)
        if (fs.existsSync(this.path)) {
          fs.rmdirSync(this.path)
        }
        ing = false
      } else {
        e.reply('地图资源安装成功！')
        this.init()
        ing = false
      }
    })
  }

  map_help (e) {
    let msg = '【#清心在哪|#渊下宫清心在哪】\n【#清心01】查询坐标信息\n【#地图资源列表】全部资源名称\n【#更新清心在哪】更新过期图片'
    e.reply(msg)
  }

  async render (data = {}) {
    let img = await puppeteer.screenshot('Map-Label', {
      tplFile: `${this.path}/label.html`,
      // saveId: app,
      imgType: 'jpeg',
      res: process.cwd() + '/resources/MysMap',
      quality: 100,
      ...data
    })
    if (img) return img
  }

  /** 读取文件 */
  read (file, isYAML = false) {
    try {
      if (!isYAML)  return JSON.parse(fs.readFileSync(file, 'utf8'))
      return YAML.parse(fs.readFileSync(file, 'utf8'))
    } catch (err) {
      return false
    }
  }

  /** 写入文件 */
  write (file, data, isYAML = false) {
    if (!isYAML) return fs.writeFileSync(file, JSON.stringify(data, null, 2))
    return fs.writeFileSync(file, YAML.stringify(data))
  }
}