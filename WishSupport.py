import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import sys

def main():
    #单次抽卡的概率
    #角色池
    def percent_character(x):
        if x <=73:
            return 0.006
        elif x <= 89:
            return (0.006+0.06*(x-73))
        else:
            return 1
    #武器池
    def percent_weapon(x):
        if x <=62:
            return 0.007
        elif x <= 73:
            return (0.007+0.07*(x-62))
        elif x <= 79:
            return (0.777+0.035*(x-73))
        else:
            return 1
    #初始化一个零矩阵
    size = 180*ExpectedCharacterNum+400*ExpectedWeaponNum+1 #这里加上1是为了让最后一行表示达成抽卡预期的状态
    TPmatrix = np.zeros((size, size))
    #角色池的初始状态设置
    CharacterPoolOffset = 0
    if ExpectedCharacterNum != 0:
        if CharacterPoolGuarantee == False:
            CharacterPoolOffset = CharacterPoolStage
        elif CharacterPoolGuarantee == True:
            CharacterPoolOffset = CharacterPoolStage+90
    #生成转移概率矩阵（矩阵前面的行是武器，后面的行是角色，最后一行表示的状态是已经达成抽卡预期）
    #这一部分代码生成抽武器的状态，如果要抽的武器数为0，那么就不会运行这一部分代码
    for i in range(0, ExpectedWeaponNum):
        offset = 400*i
        for j in range(0, 80):
            x = j % 80 + 1
            if i == ExpectedWeaponNum-1:
                #该行属于要抽的最后一把武器的部分，那么如果出限定就会进入角色部分，要加上角色池的初始偏移量
                TPmatrix[offset+j, offset+400+CharacterPoolOffset] = percent_weapon(x)*0.375
            else:
                #该行不属于要抽的最后一把武器的部分，那么抽完会进入下一把武器
                TPmatrix[offset+j, offset+400] = percent_weapon(x)*0.375
            TPmatrix[offset+j, offset+160] = percent_weapon(x)*0.375
            TPmatrix[offset+j, offset+240] = percent_weapon(x)*0.25
            TPmatrix[offset+j, offset+j+1] = 1-percent_weapon(x)
        for j in range(80, 160):
            x = j % 80 + 1
            if i == ExpectedWeaponNum-1:
                TPmatrix[offset+j, offset+400+CharacterPoolOffset] = percent_weapon(x)*0.5
            else:
                TPmatrix[offset+j, offset+400] = percent_weapon(x)*0.5
            TPmatrix[offset+j, offset+160] = percent_weapon(x)*0.5
            #在p159状态下抽卡必定成功，故一定会转移到p160状态，这里加上条件判断是为了避免覆盖前面的代码
            if j != 159:
                TPmatrix[offset+j, offset+j+1] = 1-percent_weapon(x)
        for j in range(160, 240):
            x = j % 80 + 1
            if i == ExpectedWeaponNum-1:
                TPmatrix[offset+j, offset+400+CharacterPoolOffset] = percent_weapon(x)*0.375
            else:
                TPmatrix[offset+j, offset+400] = percent_weapon(x)*0.375
            TPmatrix[offset+j, offset+320] = percent_weapon(x)*0.625
            TPmatrix[offset+j, offset+j+1] = 1-percent_weapon(x)
        for j in range(240, 320):
            x = j % 80 + 1
            if i == ExpectedWeaponNum-1:
                TPmatrix[offset+j, offset+400+CharacterPoolOffset] = percent_weapon(x)*0.5
            else:
                TPmatrix[offset+j, offset+400] = percent_weapon(x)*0.5
            TPmatrix[offset+j, offset+320] = percent_weapon(x)*0.5
            if j != 319:
                TPmatrix[offset+j, offset+j+1] = 1-percent_weapon(x)
        for j in range(320, 400):
            x = j % 80 + 1
            if i == ExpectedWeaponNum-1:
                TPmatrix[offset+j, offset+400+CharacterPoolOffset] = percent_weapon(x)
            else:
                TPmatrix[offset+j, offset+400] = percent_weapon(x)
            if j != 399:
                TPmatrix[offset+j, offset+j+1] = 1-percent_weapon(x)
    #这一部分代码生成抽角色的状态，如果要抽的角色数为0，那么就不会运行这一部分代码
    for i in range(0, ExpectedCharacterNum):
        offset = 180*i+ExpectedWeaponNum*400
        for j in range(0, 90):
            x = j % 90 + 1
            TPmatrix[offset+j, offset+180] = percent_character(x)*0.5
            TPmatrix[offset+j, offset+90] = percent_character(x)*0.5
            if j != 89:
                TPmatrix[offset+j, offset+j+1] = 1-percent_character(x)
        for j in range(90, 180):
            x = j % 90 + 1
            TPmatrix[offset+j, offset+180] = percent_character(x)
            if j != 179:
                TPmatrix[offset+j, offset+j+1] = 1-percent_character(x)
    #最后一行表示已经达成抽卡预期，所以从该状态到其他状态的概率都是0，到自身的概率为1
    TPmatrix[size-1, size-1] = 1
    #生成初始状态向量，如果抽武器，那么和武器池水位有关，否则和角色池水位有关
    initVector = np.zeros((size))
    if ExpectedWeaponNum != 0:
        if BindingNum == 0:
            if WeaponPoolGuarantee == False:
                initVector[WeaponPoolStage] = 1
            elif WeaponPoolGuarantee == True:
                initVector[WeaponPoolStage+80] = 1
        elif BindingNum == 1:
            if WeaponPoolGuarantee == False:
                initVector[WeaponPoolStage+160] = 1
            elif WeaponPoolGuarantee == True:
                initVector[WeaponPoolStage+240] = 1
        elif BindingNum == 2:
            initVector[WeaponPoolStage+320] = 1
    else:#这里是不抽武器的情况，和角色池水位有关
        initVector[CharacterPoolOffset] = 1
    #存储达到10%、25%、50%、75%、90%概率时的抽数
    percent10num = 0
    percent25num = 0
    percent50num = 0
    percent75num = 0
    percent90num = 0
    percentlist = []
    percentlist.append(0)
    #存储达到预期次数的概率
    percentRes = -1
    resultVector = initVector
    for i in range(0, 1500):
        #将初始状态向量和转移概率矩阵不断相乘，相乘的次数为抽数，得到预期次数后状态的概率分布
        resultVector = resultVector@TPmatrix
        result = resultVector[size-1]
        percentlist.append(result)
        if i == IntertwinedFateNum - 1:
            percentRes = result
        if result > 0.1 and percent10num == 0:
            percent10num = i+1
        if result > 0.25 and percent25num == 0:
            percent25num = i+1
        if result > 0.5 and percent50num == 0:
            percent50num = i+1 
        if result > 0.75 and percent75num == 0:
            percent75num = i+1
        if result > 0.9 and percent90num == 0:
            percent90num = i+1
        if result > 0.98 and (percentRes != -1 or IntertwinedFateNum == 0):
            break
#画一幅概率曲线图并保存到当前文件夹下
    ax = plt.axes()
    ax.yaxis.set_major_locator(ticker.MultipleLocator(0.1))
    ax.yaxis.set_minor_locator(ticker.MultipleLocator(0.025))
    if len(percentlist) > 500:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(100))
        ax.xaxis.set_minor_locator(ticker.MultipleLocator(25))
    elif len(percentlist) > 200:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(50))
        ax.xaxis.set_minor_locator(ticker.MultipleLocator(12.5))
    elif len(percentlist) > 80:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(20))
        ax.xaxis.set_minor_locator(ticker.MultipleLocator(5))
    elif len(percentlist) > 30:
        ax.xaxis.set_major_locator(ticker.MultipleLocator(10))
        ax.xaxis.set_minor_locator(ticker.MultipleLocator(2.5))
    ax.set_title('Genshin Wish Probability')
    ax.grid(True)
    plt.plot(percentlist)
    plt.xlim(xmin=0,xmax=len(percentlist)+5)
    plt.ylim(ymin=0,ymax=1)
    if IntertwinedFateNum != 0:
        plt.vlines(x=IntertwinedFateNum, ymin=0, ymax=percentRes, label='', linestyles='dashed')
        plt.hlines(y=percentRes, xmin=0, xmax=IntertwinedFateNum, label='', linestyles='dashed')
    #保存图片，根据图片名称来标记
    plt.savefig("data/GenshinPercent/%d,%d,%d,%d,%d,%d,%d,%d.png" %(IntertwinedFateNum,ExpectedCharacterNum,CharacterPoolGuarantee,CharacterPoolStage,ExpectedWeaponNum,WeaponPoolGuarantee,WeaponPoolStage,BindingNum))
    percentRes = str(np.round(percentRes*100,2))
    print("%s %d %d %d %d %d" % (percentRes, percent10num, percent25num, percent50num, percent75num, percent90num),end = '')
    sys.stdout.flush()

#拥有的纠缠之缘数量
IntertwinedFateNum = int(sys.argv[1])
########################## 下为角色池部分 ##########################
#期望抽到角色数（0-7）
ExpectedCharacterNum = int(sys.argv[2])
#当前是否大保底（True/False）
CharacterPoolGuarantee = bool(int(sys.argv[3]))
#角色池的水位（0-89）
CharacterPoolStage = int(sys.argv[4])
########################## 下为武器池部分 ##########################
#期望抽到武器数（0-5）
ExpectedWeaponNum = int(sys.argv[5])
#当前是否大保底（True/False）
WeaponPoolGuarantee = bool(int(sys.argv[6]))
#武器池的水位（0-79）
WeaponPoolStage = int(sys.argv[7])
#命定值（0-2）
BindingNum = int(sys.argv[8])

main()
