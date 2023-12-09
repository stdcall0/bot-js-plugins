import { segment } from "icqq";
import plugin from '../../lib/plugins/plugin.js'
import axios from 'axios';

export class BiliHotSearch extends plugin {
    constructor() {
        super(
            {
                name: 'B站热搜',
                desc: '获取B站热搜内容',
                event: 'message',
                priority: '50',
                rule: [
                    {
                        reg: '^#?[Bb]站?热搜(\\d+)?$',
                        fnc: 'processHotSearch'
                    }
                ]
            }
        )
    }

    async processHotSearch(e) {
        let match = e.msg.match(/^#?B站热搜(\d+)?$/i);

        if (!match) {
            return;
        }

        try {
            let limit = match[1] ? parseInt(match[1]) : 20;
            if (limit > 100) {
                await this.reply("热搜最多100条哦~");
                limit = 100;
            }

            const url = `https://app.bilibili.com/x/v2/search/trending/ranking?limit=${limit}`;
            const response = await axios.get(url);
            const data = response.data;

            if (data.code === 0) {
                const hotSearchList = data.data.list;
                let hotSearchResult = "";
                for (let i = 0; i < hotSearchList.length; i++) {
                    const hotSearchItem = hotSearchList[i];
                    hotSearchResult += `${hotSearchItem.position}，${hotSearchItem.show_name}\n`;
                }

                await this.reply(hotSearchResult.trim());
            } else {
                await this.reply('获取B站热搜失败');
            }

        } catch (error) {
            console.log(error);
            await this.reply(`发生错误：${error.toString()}`);
        }
    }
}