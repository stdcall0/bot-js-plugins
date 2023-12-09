/*
成分姬插件 - YunzaiBot特供版
核心代码思路来自：NoneBot2 成分姬插件 - https://github.com/noneplugin/nonebot-plugin-ddcheck
改编者：Yujio_Nako
若有bug可以在GitHub提请issue：
https://github.com/ldcivan/ddcheck_plugin
*/

import plugin from '../../lib/plugins/plugin.js'
import { segment } from "oicq";
import fetch from "node-fetch"
import schedule from 'node-schedule'
import fs from 'fs'
import cfg from '../../lib/config/config.js'
import lodash from 'lodash'
import common from '../../lib/common/common.js'

//在这里填写你的b站cookie↓↓↓↓↓
var cookie = "buvid3=6561314F-9463-F360-8272-39FD1B5FF4F509677infoc; SESSDATA=deb262de%2C1702371194%2Cf1fca%2A61;" //理论上buvid3与SESSDATA即可
//在这里填写你的b站cookie↑↑↑↑↑
//在这里填写你的自动刷新列表设置↓↓↓↓↓
let rule =`0 0 0 * * ?`  //更新的秒，分，时，日，月，星期几；日月/星期几为互斥条件，必须有一组为*
let auto_refresh = 1  //是否自动更新列表，1开0关
let masterId = cfg.masterQQ[0]  //管理者QQ账号

//v列表接口地址 https://github.com/dd-center/vtbs.moe/blob/master/api.md =>meta-cdn
var api_cdn = "https://api.vtbs.moe/meta/cdn" 



let record_num = 0
let refresh_num = 0
let record = []
let refresh = []

let refresh_task = schedule.scheduleJob(rule, async (e) => {  //定时更新
    if(auto_refresh==1){
        const res = await fetch(api_cdn, { "method": "GET" })
        const urls = await res.json()
        var local_json = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        for(var i = 0;i<Object.keys(urls).length;i++){
            try {
                var response = await fetch(urls[i]+"/v1/short", { "method": "GET" });
            } catch (e) {
                Bot.pickUser(masterId).sendMsg("发生异常:" + e)
                console.log("发生异常:" + e)
            }
            if(response.status==200){
                await Bot.pickUser(masterId).sendMsg(`使用api：${urls[i]}`)
                break
            }
        }
        let v_list = await response.json()
        
        record_num = 0
        refresh_num = 0
        record = []
        refresh = []
        for(var j = 0;j<Object.keys(v_list).length;j++){
            var data = {
                "uname": v_list[j].uname,
                "roomid":v_list[j].roomid
            }
            if(!local_json.hasOwnProperty(v_list[j].mid)) {//如果json中不存在该用户
                local_json[v_list[j].mid] = data
                console.log(`${v_list[j].mid}已记录`)
                record.push(`${v_list[j].mid}已记录`)
                record_num++
            }else{
                if(local_json[v_list[j].mid].uname != data.uname || local_json[v_list[j].mid].roomid != data.roomid) //存在但有变化
                {   
                    console.log(`${v_list[j].mid}已刷新`)
                    refresh.push(`${v_list[j].mid}已刷新，${JSON.stringify(local_json[v_list[j].mid])}→${JSON.stringify(data)}`)
                    local_json[v_list[j].mid] = data
                    refresh_num++
                }
            }
        }
        await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
        await Bot.pickUser(masterId).sendMsg(`虚拟主播列表更新完毕，共获取${Object.keys(v_list).length}条信息，现存在${Object.keys(local_json).length}条信息！`)
        if(record_num!=0) {
            await Bot.pickUser(masterId).sendMsg(`新增了${record_num}条`)
            if(record_num<=10) {await Bot.pickUser(masterId).sendMsg(`${record}`)}
        }
        if(refresh_num!=0) {
            await Bot.pickUser(masterId).sendMsg(`更新了${refresh_num}条`)
            if(refresh_num<=10) {await Bot.pickUser(masterId).sendMsg(`${refresh}`)}
        }
        await Bot.pickUser(masterId).sendMsg(`成分姬 V列表自动更新已完成`)
    }
})


const attention_url = "https://account.bilibili.com/api/member/getCardByMid?mid=" //B站基本信息接口 含关注表
const medal_url = "https://api.live.bilibili.com/xlive/web-ucenter/user/MedalWall?target_id=" //粉丝牌查询接口
const search_url = `https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=bili_user&keyword=` //昵称转uid
const dirpath = "plugins/example/cha_chengfen" //本地V列表文件夹
var filename = `vtuber_list.json` //本地V列表文件名
if (!fs.existsSync(dirpath)) {//如果文件夹不存在
	fs.mkdirSync(dirpath);//创建文件夹
}
if (!fs.existsSync(dirpath + "/" + filename)) {
    fs.writeFileSync(dirpath + "/" + filename, JSON.stringify({
    }))
}

export class example extends plugin {
    constructor() {
        super({
            name: 'DDchecker',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#?查?成分帮助$',
                    fnc: 'chengfen_help'
                },
                {
                  reg: "^#?更新(V|v)列表$",
                  fnc: 'get_v_list'
                },
                {
                  reg: "^#?查?成分.*$",
                  fnc: 'cha_chengfen'
                }
            ]
        })
    }


    async cha_chengfen(e) {
        let base_info = []
        let message = []
        let mid = e.msg.replace(/#| |查?成分/g, "")
        if(mid == "") {
            this.chengfen_help(e)
            return
        }
        let name = ''
        if(isNaN(mid)){
            var uid_name = await this.name2uid(mid)
            mid = uid_name["mid"]
            name = uid_name["name"]
            if (isNaN(mid)) {
                this.reply(`无法由该昵称(${name})转换为uid`)
                return false
            }
            else{
                this.reply(`已使用uid：${mid}，昵称为：${name}`)
            }
        }
        const vtb_list = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        const attention_list = await this.get_attention_list(mid)
        if(attention_list.card.attention!=0 && JSON.stringify(attention_list.card.attentions)=="[]"){
            this.reply(`对方可能隐藏了关注列表`)
            return
        }
        const medal_list = await this.get_medal_list(mid)
        await base_info.push(segment.image((attention_list.card.face)))
        await base_info.push(`${JSON.stringify(attention_list.card.name).replaceAll(`\"`, ``)}  Lv${JSON.stringify(attention_list.card.level_info.current_level)}\n粉丝：${attention_list.card.fans}\n关注：${Object.keys(attention_list.card.attentions).length}\n`)
        if(attention_list.card.official_verify.type!=-1)
            await base_info.push(`bilibili认证：${JSON.stringify(attention_list.card.official_verify.desc).replaceAll(`\"`, ``)}`)
        
        var v_num = 0
        for(var i = 0;i<Object.keys(attention_list.card.attentions).length;i++){
            if(vtb_list.hasOwnProperty(attention_list.card.attentions[i])) {//如果json中存在该用户
                let uid = attention_list.card.attentions[i]
                message.push(`${JSON.stringify(vtb_list[uid].uname).replaceAll("\"","")} - ${uid}\n`)
                if(medal_list.hasOwnProperty(attention_list.card.attentions[i])){
                    message.push(`└${JSON.stringify(medal_list[uid].medal_name).replaceAll("\"","")}|${medal_list[uid].level}\n`)
                }
                v_num++
            }
        }
        message.unshift(`${(v_num/(i)*100).toFixed(2)}% (${v_num}/${i})\n-------\n`)
        
        let forwardMsg = await this.makeForwardMsg(`查成分结果：`, base_info, message)
        await this.reply(forwardMsg)
        return
    }
    
    async name2uid(name) {
        //https://api.bilibili.com/x/web-interface/wbi/search/type?page=1&page_size=36&platform=pc&keyword=%E8%8B%A6%E6%80%95creep-II&search_type=bili_user
        try {
            var response = await fetch(search_url+name, { "headers": {"cookie": cookie, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"}, "method": "GET" });
        } catch (e) {
            this.reply("name2uid请求发生异常:" + e + "，可能是cookie中的buvid3失效导致")
            console.log("name2uid请求发生异常:" + e)
        }
        let search_result = await response.json()
        if(search_result['code']==0){
            if(search_result['data']['numResults'] != 0){
                let uid = search_result['data']['result'][0]['mid']
                let name = search_result['data']['result'][0]['uname']
                let uid_name = {"mid": parseInt(uid), "name": name}
                return uid_name
            }
            else {
                this.reply("无法由昵称转为uid：搜索结果为0")
                return false
            }
        }
        else {
            this.reply("昵称转uid解析过程发生异常:"+JSON.stringify(search_result))
            console.log("昵称转uid解析过程发生异常")
            return false
        }
    }
    
    async get_v_list(e) {
        const res = await fetch(api_cdn, { "method": "GET" })
        const urls = await res.json()
        var local_json = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        for(var i = 0;i<Object.keys(urls).length;i++){
            try {
                var response = await fetch(urls[i]+"/v1/short", { "method": "GET" });
            } catch (e) {
                this.reply("发生异常:" + e)
                console.log("发生异常:" + e)
            }
            if(response.status==200){
                await this.reply(`使用api：${urls[i]}`)
                break
            }
        }
        let v_list = await response.json()
        
        record_num = 0
        refresh_num = 0
        record = []
        refresh = []
        for(var j = 0;j<Object.keys(v_list).length;j++){
            var data = {
                "uname": v_list[j].uname,
                "roomid":v_list[j].roomid
            }
            if(!local_json.hasOwnProperty(v_list[j].mid)) {//如果json中不存在该用户
                local_json[v_list[j].mid] = data
                console.log(`${v_list[j].mid}已记录`)
                record.push(`${v_list[j].mid}已记录`)
                record_num++
            }else{
                if(local_json[v_list[j].mid].uname != data.uname || local_json[v_list[j].mid].roomid != data.roomid) //存在但有变化
                {   
                    console.log(`${v_list[j].mid}已刷新`)
                    refresh.push(`${v_list[j].mid}已刷新，${JSON.stringify(local_json[v_list[j].mid])}→${JSON.stringify(data)}`)
                    local_json[v_list[j].mid] = data
                    refresh_num++
                }
            }
        }
        await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
        await this.reply(`虚拟主播列表更新完毕，共获取${Object.keys(v_list).length}条信息，现存在${Object.keys(local_json).length}条信息！`)
        if(record_num!=0) {await this.reply(`新增了${record_num}条`)
            if(record_num<=5) {await this.reply(`${record}`)}
        }
        if(refresh_num!=0) {await this.reply(`更新了${refresh_num}条`)
            if(refresh_num<=5) {await this.reply(`${refresh}`)}
        }
    }
    
    async get_attention_list(mid) {
        var response = await fetch(attention_url+mid, { "method": "GET" });
        if (response.status>=400&&response.status<500) {
            await this.reply("404，可能是uid不存在")
            return false
        }
        var attention_list = await response.json()
        if(attention_list.code!=0){
            await this.reply(`获取目标关注列表失败，可能是查无此人：${attention_list.message}`)
            return false
        }
        return attention_list
    }
    
    async get_medal_list(mid) {
        var response = await fetch(medal_url+mid, { "headers": {"cookie": cookie},"method": "GET" });
        if (response.status==404) {
            await this.reply("404，可能是uid不存在")
            return false
        }
        var medal_list_raw = await response.json()
        var medal_list = {}
        if(medal_list_raw.code!=0){
            await this.reply(`获取粉丝牌数据错误：${JSON.stringify(medal_list_raw.message)}，一般是cookie中的SESSDATA过期导致`)
            return medal_list
        }
        for(var i = 0;i<Object.keys(medal_list_raw.data.list).length;i++){
            var data = {
                "level":medal_list_raw.data.list[i].medal_info.level,
                "medal_name":medal_list_raw.data.list[i].medal_info.medal_name
            }
            medal_list[medal_list_raw.data.list[i].medal_info.target_id] = data
        }
        return medal_list
    }
    
    async makeForwardMsg (title, base_info, msg) {
    let nickname = Bot.nickname
    if (this.e.isGroup) {
      let info = await Bot.getGroupMemberInfo(this.e.group_id, Bot.uin)
      nickname = info.card ?? info.nickname
    }
    let userInfo = {
      user_id: Bot.uin,
      nickname
    }

    let forwardMsg = [
      {
        ...userInfo,
        message: title
      },
      {
        ...userInfo,
        message: base_info
      },
      {
        ...userInfo,
        message: msg
      }
    ]

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, '')
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)

    return forwardMsg
  }
  async chengfen_help(e){
      await this.reply("查成分帮助\n1.发送 #更新v列表 更新主播列表到本地，建议每周至少更新一次\n2.使用 #查成分 目标uid或者昵称全称 获取目标的成分，包括关注的V/游戏官号以及对应的粉丝牌")
  }
}
