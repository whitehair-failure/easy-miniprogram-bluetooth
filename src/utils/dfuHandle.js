import * as comm from "../comm";
import * as t from "./tools";
import * as BLE from "./ble"
import * as crc from "../modbus/crc"
import * as ModbusException from "../modbus/modbusError"
const MAX_RETRIES = 3; // 每个数据包的最大重试次数
const app = getApp();

/**
 *  // 新版本机器，1.请求进入boot 回复3 需要重发进入boot 请求，避免误进
 *  // 所有指令回复3 走重发
 */
class DFUHandler {
    constructor({
        packageData,
        progress,
        state,
        success,
        error,
    }) {
        this.DFUNotifyCharacteristicId = "00001531-1212-EFDE-1523-785FEABCD123"
        this.DFUServiceUId = "00001530-1212-EFDE-1523-785FEABCD123"
        this.deviceId = app.globalData.ble.dev.deviceId
        this.dfuResolve = null;
        this.dfuReject = null;
        this.currentStep = null;
        if (!packageData || !progress || !state || !success || !error) throw new Error("DFU初始化失败,请传入所需回调函数")
        this.upgardeEnd = 100 //升级进度终点
        this.firmwareData = packageData
        this.progress = progress
        this.state = state
        this.success = success
        this.error = error
        this.progressValue = 0
        let ble = app.globalData.ble;

    }


    async sentDFUFrame(frame) {
        let retries = 0;
        let res = -1
        while (retries <= 3) {
            try {
                res = await BLE.withTimeout(new Promise((resolve, reject) => {
                    this.dfuResolve = resolve;
                    this.dfuReject = reject;
                    console.log("sendCommand", comm.bufferToHex(frame));
                    t._writeBLECharacteristicValue
                        .call(app.globalData.ble, frame)
                        .then((res) => {
                            console.log("wait response...");
                        })
                        .catch((err) => {
                            console.log("sentMoubusFrame-err", err);
                            reject(err);
                        });
                }),20000);
                return res
            } catch (error) {
                if(error == 3){
                    retries++;
                    if (retries > MAX_RETRIES) {
                        console.error("超过最大重试次数，放弃发送当前数据包");
                        return Promise.reject(new Error("发送失败，超出最大重试次数"));
                    }
                    console.log("失败重发",comm.bufferToHex(frame))

                }else{
                    throw error
                }

                
            }
        }

        // return BLE.withTimeout(asyncOperationPromise,20000);
    }


    async startUpgrade() {

        let ble = app.globalData.ble
        let PACKET_SIZE = 32;
        const firmwareDataByteArray = new Uint8Array(this.firmwareData);
        const binDataSizeHex = [];
        console.log('firmwareData.byteLength',this.firmwareData.byteLength)
        for (let i = 0; i < 4; i++) {
            const byte = (this.firmwareData.byteLength >> (i * 8)) & 0xff;
            binDataSizeHex.unshift(byte);
        }

        console.log('firmwareData.byteLength',comm.ab2hex(binDataSizeHex))

        let that = this
        ble.registerDFUProgressCallback((res) => {
            console.log("dfu-response", comm.ab2hex(res));

            var respStatus = this.parseDfuCommand(res)

            //0中断流程，3重发
            if(respStatus == 0 || respStatus == 3){
                console.log("升级指令异常", respStatus)
                this.dfuReject(respStatus)
                return
            }

          
            this.dfuResolve(respStatus)

        })


        let stepPres = [{
                label: "1.请求进入boot",           
                command: async function () {
                    let srcframe = new Array()
                    srcframe.push(...[0x75, 0x70,0x01])
                    let crcCodes = crc.crcCheck(srcframe)
                    srcframe.push(...crcCodes)
                    let targetFrame = new Uint8Array(srcframe)
                    let res = await that.sentDFUFrame(targetFrame.buffer)
                    that.progressValue += 1
                    that.progress(that.progressValue) 
                    return res;
                }
            },
            {
                label: "2.升级初始化，写固件信息",
                command: async function () {

                    await new Promise(async function(resolve,reject){
                        let srcframe = new Array()
                        srcframe.push(...[0x75, 0x70,0x02])
                        srcframe.push(...binDataSizeHex)
                        let crcCodes = crc.crcCheck(srcframe)
                        srcframe.push(...crcCodes)
                        let targetFrame = new Uint8Array(srcframe)
    
                        var res = 0
                        while (true) {
                            res = await that.sentDFUFrame(targetFrame.buffer).catch(e=>{
                                console.log("升级初始化失败")
                                reject(e)
                            })

                            if(res == 0x00){
                                reject('设备未收到 升级初始化，写固件信息 指令')
                                return
                            }

                            if(res == 0x88){
                                resolve()
                                return  
                            }
                            
                            if(res == 0x01){
                                PACKET_SIZE = 32
                                continue
                            }

                            if(res == 0x02){
                                PACKET_SIZE = 60
                                continue
                            }
                         
                        }
                    })

                    that.progressValue += 2
                    that.progress(that.progressValue) 
                    
                 
                }
            },
            
            {
                label: "3.发送固件bin数据",
                command: async function () {
                    return new Promise(async function(resolve, reject){
                        const packets = [];
                        console.log("准备发送bin")

                        for (let i = 0; i < firmwareDataByteArray.length; i += PACKET_SIZE) {
                            let packet = firmwareDataByteArray.slice(i, i + PACKET_SIZE);
                        
                            // 如果最后一包长度不足 PACKET_SIZE，则填充0
                            if (packet.length < PACKET_SIZE) {
                                let paddingLength = PACKET_SIZE - packet.length;
                                let padding = new Uint8Array(paddingLength); 
                                packet = new Uint8Array([...packet, ...padding]);
                            }
                        
                            packets.push(packet);
                        }

                        try {
                            await that.sendPacketsWithRetries(packets);
                            console.log("发送bin完成");
                        } catch (error) {
                            console.error("3.发送固件bin数据 错误", error);
                            reject(error)
                        }
                        //通知设备发送完成bin
                        let sendFinishSrc = [0x75, 0x70, 0x03].concat(binDataSizeHex)
                        let crcCodes = crc.crcCheck(sendFinishSrc)
                        console.log("snedFinishSize-crc:",crcCodes)
                        sendFinishSrc.push(...crcCodes)
                        await that.sentDFUFrame(new Uint8Array(sendFinishSrc).buffer)
                        resolve()
                    })

                }
            },
            {
                label: "4.通知设备flash",
                command: async function () {
                    let srcframe = [0x75, 0x70,0x04]
                    let crcCodes = crc.crcCheck(srcframe)
                    let targetFrame = new Uint8Array(srcframe.concat(crcCodes))
                    await that.sentDFUFrame(targetFrame.buffer)
                    that.progressValue +=5;
                    that.progress(that.progressValue);
                }
            },
            {
                label: "5.校验文件",
                command: async function () {
                    
                    let srcframe = [0x75, 0x70,0x05]
                    let crcCodes = crc.crcCheck(srcframe)
                    let targetFrame = new Uint8Array(srcframe.concat(crcCodes))
                    await that.sentDFUFrame(targetFrame.buffer)
                    that.progressValue +=5;
                    that.progress(that.progressValue);
                }
            },
            {

                label: "6.应用固件并重启",
                command: async function () {
                    let srcframe = [0x75, 0x70,0x06]
                    let crcCodes = crc.crcCheck(srcframe)
                    let targetFrame = new Uint8Array(srcframe.concat(crcCodes))
                    await that.sentDFUFrame(targetFrame.buffer)
                    that.progressValue +=5;
                    that.progress(that.progressValue);
                }
            },
        ]

        new Promise(async function (resolve, reject) {
            for (let index = 0; index < stepPres.length; index++) {
                const step = stepPres[index];

                try {
                    that.currentStep = step
                    console.log(step.label + "--" + "正在发送")

                    let res = await step.command()
                  
                    
                    that.state(step.label + "--" + "成功")

                } catch (error) {
                    console.log("error",error)
                    let errMes = step.label + "失败"
                    that.state(errMes)
                    reject(errMes)
                    return;
                }

            }
            console.log('Promise-升级成功')
            
            
            resolve()
        }).then(() => {
            that.success()
            that.upgardeEnd = 0
        }).catch((err) => {
            console.log(err);
            that.error(err)

        })

    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }


    async  sendPacketsWithRetries(packets) {
        for (let index = 0; index < packets.length; index++) {

            let numArray = []
            const packet = packets[index];
            console.log('sendPacketsWithRetries-srcframe',packet)

            let srcframe = [0x75, 0x70, 0x03];

            for (let i = 0; i < 2; i++) {
                const byte = (index+1 >> (i * 8)) & 0xff;
                numArray.unshift(byte);
              }

              srcframe.push(...numArray)
              srcframe.push(...packet)
            let crcCodes = crc.crcCheck(srcframe);
            srcframe = srcframe.concat(crcCodes);
            console.log('sendPacketsWithRetries-srcframe',srcframe)
            let targetFrame = new Uint8Array(srcframe);
            await this.sentDFUFrame(targetFrame.buffer);

    
            // if (!success) {
            //     console.error("无法成功发送所有数据包，退出固件更新");
            //     return Promise.reject(new Error("无法成功发送所有数据包"));
            // }

    
            this.progressValue =  (index + 1) * (80/packets.length)+15;
            this.progress(this.progressValue);
            // await this.delay(20);
        }
    }
    


    parseDfuCommand(resp){
        let status = resp[3]
        const crcBytes = resp.slice(-2);
        const subArr = resp.slice(0, -2); 
        const calculatedCRC = crc.crcCheck(subArr);
        console.log('parseDfuCommand-calculatedCRC',calculatedCRC)
        if (!crcBytes.every((value, index) => value == calculatedCRC[index])) {
            throw ModbusException.createModbusException(ModbusException.ModbusExceptionCodes.INVALID_FRAME);
        }

        // if(status == 0x00){
        //     throw Error(0x00)
        // }

        return status;
    }
   

    




}
export {
    DFUHandler
};