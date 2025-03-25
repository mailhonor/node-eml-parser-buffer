# node-eml-parser-buffer

## 说明

网址: https://gitee.com/linuxmail/node-eml-parser-buffer/

邮件解析库, 充分考虑字符集问题, 本库作者认为: 有大量的邮件含有8bit文字,而这些文字不是UTF-8编码

## 特别说明

下划线(_)开头的属性和函数是私有的,不应该使用

## 接口

```
// new emlParser 的参数
export interface ParserOptions {
    emlData: Buffer;
    debug?: boolean;
}

// 邮件头行,字符串节点
export interface TokenNode {
    data: Buffer;
    charset: string;
}

// 邮件头行的,值和键值对
export interface MimeValueParams {
    value: Buffer;
    params: {
        [key: string]: Buffer;
    };
}

// 邮件头行
export interface MimeLine {
    name: string;
    value: Buffer;
}

// 邮件地址
export interface MimeAddress {
    name: string;
    address: string;
}

// 未解码的邮件地址
export interface MimeAddressDecoder {
    nameBuffer: Buffer;
    address: string;
}
```

## 用法 

参考, examples/ 例子

```
const emlParser = require("eml-parser-buffer")
```

### CLASS emlParser

emlData, 是 Buffer, 不能是 String

```
var options = {
    emlData: fs.readFileSync("somepath") // 应该是 Buffer
}
var parser = new emlParser.emlParser(options)
```

emlParser 的属性如下:

```
subject: null | string
from: null | MimeAddress
to: null | MimeAddress[]
cc: null | MimeAddress[]
bcc: null | MimeAddress[]
messageId: null | string
date: null | string
dateUnix: number
sender: null | MimeAddress
replyTo: null | MimeAddress
dispositionNotificationTo: null | MimeAddress
references: null | (string[])
topNode: mimeNode
```

emlParser 的 get 属性如下:

```
// 所有的Mime节点
get allNodes(): mimeNode[]
// 所有的可显的正文文本节点
get textNodes()
// 所有优先显示的正文文本节点(优先html)
get alternativeShowNodes()
//所有的附件节点
get attachmentNodes()
```

emlParser 的方法

```
// 返回第一个名字是name的邮件头行
getFirstHeaderLine(name: string)
```

### CLASS mimeNode

邮件 Mime 结构的节点类

mimeNode 的属性如下:

```
parser: emlParser
headerStartPos: number
headerLength: number
headers: MimeLine[]
bodyStartPos: number
bodyLength: number
contentType: string
encoding: string
charset: string
name: string
filename: string
contentId: string
disposition: string
boundary: string
parent: null | mimeNode
childs: null | mimeNode[]
```

mimeNode 的 get 属性如下:

```
// 是否内嵌(图片)附件
get isInline()

// 是否是 TNEF 类型附件
get isTnef()

// (如果是 TEXT/* 类型)获取解码并字符集转码后的文本
get textContent(): string 
```

mimeNode 的方法

```
// 获取解码后的附件内容
getDecodedBuffer(): Buffer
// 获取名字为name的第一个 Mime 头行
getFirstHeaderLine(name: string): null | MimeLine
```

### 其他工具函数

```
// 解码 rfc2231 规范的文件名/属性值等
function decode2231(data: Buffer, withCharset: boolean): TokenNode[];
// 如上, 并转码为字符串
function decode2231ToString(data: Buffer, withCharset: boolean): string;
// 在一堆params里面, 转码键为name的值并转码为字符串
function decodeParamToString(params: { [name: string]: Buffer; }, name: string): string;
// 解析邮件头行
function decodeValue(line: Buffer): TokenNode[];
// 如上, 并转码为字符串
function decodeValueToString(line: Buffer): string;
// 解析邮件头行
function decodeLineToValueAndParams(line: Buffer): MimeValueParams;
``` 

### 字符集转UTF8

默认采用的是 iconv-lite， 但是 iconv-lite 不支持 iso-2022-jp/cn 等

可以设置转码函数

```
type CharsetConverter = (data: Buffer, charset: string) => string | null
export function setCharsetConvertHandler(converter: CharsetConverter | undefined);
``` 