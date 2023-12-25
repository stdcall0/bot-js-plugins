import plugin from '../../lib/plugins/plugin.js'
import { segment } from 'oicq'
import { exec } from 'child_process'
import fs from 'fs'

export class WishCalculator extends plugin {
    constructor() {
        super({
        name: "祈愿概率计算",
        dsc: "祈愿概率计算",
        /** https://oicqjs.github.io/oicq/#events */
        event: "message.group",
        priority: 150,
        rule: [
            {
                reg: /^\d{1,4}，\d，\d，\d{1,2}，\d，\d，\d{1,2}，\d$/,
                fnc: "calculate",
            },
            {
                reg: /^#*(概率|期望|计算|概率计算)$/,
                fnc: "help",
            }
        ]
        });
    }

    init() {
        let file = './data/GenshinPercent/'
        if (!fs.existsSync(file)) {
          fs.mkdirSync(file)
        }
    }

    async calculate(e) {
        let message = e.msg
        let numbers = message.split('，')
        if (parseInt(numbers[0]) > 1500) {
            await e.reply("非法数据，抽数大于1500")
            return
        }
        if (parseInt(numbers[1]) > 7) {
            await e.reply("非法数据，预期抽到角色数大于7")
            return
        }
        if (parseInt(numbers[3]) > 89) {
            await e.reply("非法数据，角色池水位大于89")
            return
        }
        if (parseInt(numbers[4]) > 5) {
            await e.reply("非法数据，预期抽到武器数大于5")
            return
        }
        if (parseInt(numbers[6]) > 79) {
            await e.reply("非法数据，武器池水位大于79")
            return
        }
        if (parseInt(numbers[7]) > 2) {
            await e.reply("非法数据，命定值大于2")
            return
        }
        if (parseInt(numbers[1]) + parseInt(numbers[4]) == 0) {
            await e.reply("你什么都不抽，我怎么帮你计算")
            return
        }
        // #拥有的纠缠之缘数量
        let IntertwinedFateNum = parseInt(numbers[0])
        // #期望抽到角色数（0-7）
        let ExpectedCharacterNum = parseInt(numbers[1])
        // #当前是否大保底（True/False）
        let CharacterPoolGuarantee = parseInt(numbers[2])
        // #角色池的水位（0-89）
        let CharacterPoolStage = parseInt(numbers[3])
        // #期望抽到武器数（0-5）
        let ExpectedWeaponNum = parseInt(numbers[4])
        // #当前是否大保底（True/False）
        let WeaponPoolGuarantee = parseInt(numbers[5])
        // #武器池的水位（0-79）
        let WeaponPoolStage = parseInt(numbers[6])
        // #命定值（0-2）
        let BindingNum = parseInt(numbers[7])

        let nickname = e.sender.card
        let rep = " "
        if (ExpectedCharacterNum == 0) {
            rep = `开始为${nickname}计算抽取${ExpectedWeaponNum}精的概率`
        } else if (ExpectedWeaponNum == 0) {
            rep = `开始为${nickname}计算抽取${ExpectedCharacterNum-1}命的概率`
        } else {
            rep = `开始为${nickname}计算抽取${ExpectedCharacterNum-1}命${ExpectedWeaponNum}精的概率`
        }
        await e.reply(rep)

        exec(`python plugins/example/WishSupport.py ${IntertwinedFateNum} ${ExpectedCharacterNum} ${CharacterPoolGuarantee} ${CharacterPoolStage} ${ExpectedWeaponNum} ${WeaponPoolGuarantee} ${WeaponPoolStage} ${BindingNum}`,{ windowsHide: true },(error, stdout, stderr) => {
            if (error) {
                console.log(`[Error]: ${error}`)
                return
            }
            if (stderr) {
                console.log(`[Std Error]: ${stderr}`)
                return
            }
            let results = stdout.split(" ")
            let percentage = Number(results[0])
            let msg = `\n${IntertwinedFateNum}抽达到预期的概率为${results[0]}%\n`
            if (parseInt(numbers[0]) == 0) {
                msg = " \n"
            }
            if (percentage<10) {
                msg = msg+
                `达成10%概率需要${results[1]}抽\n`+
                `达成25%概率需要${results[2]}抽\n`+
                `达成50%概率需要${results[3]}抽\n`+
                `达成75%概率需要${results[4]}抽\n`+
                `达成90%概率需要${results[5]}抽\n`
            } else if (percentage<25) {
                msg = msg+
                `达成25%概率需要${results[2]}抽\n`+
                `达成50%概率需要${results[3]}抽\n`+
                `达成75%概率需要${results[4]}抽\n`+
                `达成90%概率需要${results[5]}抽\n`
            } else if (percentage<50) {
                msg = msg+
                `达成50%概率需要${results[3]}抽\n`+
                `达成75%概率需要${results[4]}抽\n`+
                `达成90%概率需要${results[5]}抽\n`
            } else if (percentage<75) {
                msg = msg+
                `达成75%概率需要${results[4]}抽\n`+
                `达成90%概率需要${results[5]}抽\n`
            } else if (percentage<90) {
                msg = msg+
                `达成90%概率需要${results[5]}抽\n`
            } else {
                msg = msg
            }
            let img = segment.image(`data/GenshinPercent/${IntertwinedFateNum},${ExpectedCharacterNum},${CharacterPoolGuarantee},${CharacterPoolStage},${ExpectedWeaponNum},${WeaponPoolGuarantee},${WeaponPoolStage},${BindingNum}.png`)
            e.reply([segment.at(e.user_id),msg,img])
        })

        return
    }

    async help(e) {
        let title = "祈愿预期概率计算帮助"
        let body = "按照如下顺序提供数据：\n"+
                    "1、拥有粉球数（0-1500）\n"+
                    "2、期望抽到角色数（0-7）\n"+
                    "3、角色池是否大保底（0/1）\n"+
                    "4、角色池当前水位（0-89）\n"+
                    "5、期望抽到武器数（0-5）\n"+
                    "6、武器池是否大保底（0/1）\n"+
                    "7、武器池当前水位（0-79）\n"+
                    "8、武器池命定值（0-2）\n\n"+
                    "例如我当前拥有400抽，计算从0开始抽2命1精的概率则发送如下消息:\n\n"+
                    "400，3，0，0，1，0，0，0"
        await e.reply(body)
        return
    }

}