 function ab2hex(buffer) {
     return Array.prototype.map
       .call(buffer, (x) => ('00' + x.toString(16)).slice(-2))
       .join(' ');
 }

 /**
  * 
  * @param {ArrayBuffer} buffer 
  */
 function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
  }
 /**
  * 
  * @param {number} number -数字
  */
 function numToHexArray(number) {
    // 使用 toString(16) 将整数转换为十六进制字符串
    const hexString = number.toString(16);
    
    // 将十六进制字符串拆分为每个字符，并转为整数数组
    const hexArray = hexString.split('').map(hexChar => parseInt(hexChar, 16));

    return hexArray;
}

//小数字符串转16进制
function decimalStringToHex(numStr,decimalPlaces) {
    if(typeof(numStr) === "number"){
        numStr = numStr.toString()
    }
    let [integerPart, fractionalPart] = numStr.split('.');

    // 如果输入的是整数，则在小数部分补零
    if (!fractionalPart) {
        fractionalPart = ''.padStart(decimalPlaces, '0');
    } else {
        // 如果小数部分的长度小于decimalPlaces，则补零
        fractionalPart = fractionalPart.padEnd(decimalPlaces, '0');
    }

    // 拼接整数和处理后的小数部分
    const numStrWithZeros = integerPart + fractionalPart;
    // 转换为整数
    const numInt = parseInt(numStrWithZeros, 10);
    // 转换为16进制字符串
    return numInt.toString(16);
  }

//16进制字符串 格式化为 2个字节
function hexStringToTwoBytes(hexStr) {
    // 确保16进制字符串至少有4位
    hexStr = hexStr.padStart(4, '0');
  
    // 提取高位字节和低位字节
    const highByteStr = hexStr.substr(0, 2);
    const lowByteStr = hexStr.substr(2, 2);
  
    // 将16进制字符串转换为字节
    const highByte = parseInt(highByteStr, 16);
    const lowByte = parseInt(lowByteStr, 16);
  
    // 返回包含两个字节的数组
    return [highByte, lowByte];
  }

/**
 * 将输入值（小数字符串或整数）转换为两个16进制字节
 * @param {*} paramItem Param
 */
function inputToHexByte(paramItem) {
    const decimalPlaces = paramItem.decimalPlaces
    var inputValue = paramItem.inputValue
    var array = new Uint8Array()
    console.log("inputToHexByte",inputValue);

    if (decimalPlaces > 0) {
        let hexStr = decimalStringToHex(inputValue, decimalPlaces)
        array = hexStringToTwoBytes(hexStr)
        console.log("小数转16进制", hexStr)
        console.log("array", array)
    } else {
        let hexStr = parseInt(inputValue).toString(16)
        console.log("整体转16进制：", hexStr)
        array = hexStringToTwoBytes(hexStr)
    }
    return array
}


//计算二进制补码
function calculateTwosComplement(decimalNumber, numBits=16) {
    let binaryString = decimalNumber.toString(2);

    // 零填充二进制字符串，以确保所需的位数
    binaryString = binaryString.padStart(numBits,0)

    console.log("binaryString",binaryString)
    console.log("binaryString[0]",binaryString[0])

    // 检查数字是否为负数
    if (binaryString[0] == "1") {
        // Invert all bits
        let invertedString = '';
        for (let i = 0; i < binaryString.length; i++) {
            invertedString += binaryString[i] === '0' ? '1' : '0';
        }

        return parseInt(invertedString,2)+1;
    } else {
        //整数直接反回
        return decimalNumber;
    }
}

function hexToDecimalism(hex, isSigned = false) {
  try {
    let decimal = BigInt(`0x${hex}`);
    if (isSigned) {
      let mask = BigInt(1) << BigInt(hex.length * 4 - 1);
      if (decimal & mask) {
        decimal -= mask << BigInt(1);
      }
    }
    return decimal.toString();
  } catch (error) {
    console.error("Failed to parse String to BigInt:", error);
    return "0";
  }
}

function int16ToByteArray(num) {
    const arrayBuffer = new ArrayBuffer(4);
    const dataView = new DataView(arrayBuffer);
    dataView.setUint16(0, num, false); // 大端序
    return new Uint8Array(arrayBuffer);
  }

  //十六进制转ASCII码
function hexToAscii(hexCharCodeStr) {
    var trimedStr = hexCharCodeStr.trim();
    var rawStr = trimedStr;
    var len = rawStr.length;
    if (len % 2 !== 0) {
     console.log('数据错误')
      return "";
    }
    var curCharCode;
    var resultStr = [];
    for (var i = 0; i < len; i = i + 2) {
      curCharCode = parseInt(rawStr.substr(i, 2), 16);
      resultStr.push(String.fromCharCode(curCharCode));
    }
    return resultStr.join("");
  }


 export{
     ab2hex,
     numToHexArray,
     bufferToHex,
     decimalStringToHex,
     hexStringToTwoBytes,
     inputToHexByte,
     calculateTwosComplement,
     int16ToByteArray,
     hexToAscii,
     hexToDecimalism
 }