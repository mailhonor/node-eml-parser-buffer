import Iconv from "iconv-lite"
import jschardet from "jschardet"

export interface ParserOptions {
    emlData: Buffer
    debug?: boolean
}

declare interface TokenNode {
    data: Buffer
    charset: string
}
export default TokenNode;

export interface MimeValueParams {
    value: Buffer
    params: {
        [key: string]: Buffer
    }
}

export interface MimeLine {
    name: string // toUpperCase
    value: Buffer
}

export interface MimeAddress {
    name: string
    address: string // toLowerCase
}

export interface MimeAddressDecoder {
    nameBuffer: Buffer
    address: string // toLowerCase
}

interface mime_boundary {
    boundary: string
    startPos: number
    endPos: number
}

function _line_buffer_skip_char(line: Buffer, skip: string): number {
    let i = 0
    for (i = 0; i < line.length; i++) {
        let ch = String.fromCharCode(line[i])
        if (skip.indexOf(ch) > -1) {
            continue
        }
        return i
    }
    return -1
}

function _line_buffer_find_char(line: Buffer, delim: string): number {
    let i = 0
    for (i = 0; i < line.length; i++) {
        let ch = String.fromCharCode(line[i])
        if (delim.indexOf(ch) < 0) {
            continue
        }
        return i
    }
    return -1
}

type CharsetConverter = (data: Buffer, charset: string) => string | null

let charsetConverter: CharsetConverter | undefined
export function setCharsetConvertHandler(converter: CharsetConverter | undefined) {
    charsetConverter = converter
}

export function decodeBufferToStringMaybeDetactCharset(data: Buffer, charset: string) {
    function _try(cs: any) {
        try {
            if (typeof cs != "string") {
                cs = cs.encoding
            }
            if (charsetConverter) {
                return charsetConverter(data, charset)
            }
            let newbf = r = Iconv.decode(data, cs)
            return newbf.toString()
        } catch {
            return null
        }
    }
    let r: null | string = null
    if (charset == "") {
        let tmp = jschardet.detect(data)
        r = _try(tmp)
    } else {
        r = _try(charset)
        if (r === null) {
            let tmp = jschardet.detect(data)
            r = _try(tmp)
        }
    }
    if (r === null) {
        return data.toString()
    }
    return r
}


function _decode_header_base64(data: Buffer): Buffer {
    let rs: Buffer[] = []
    let b = data.toString()
    while (b.length) {
        let pos = b.indexOf("=")
        if (pos < 0) {
            rs.push(Buffer.from(b, "base64"))
            break
        }
        pos++
        while (pos < b.length) {
            if (b[pos] == "=") {
                pos++
                continue
            }
            break
        }
        rs.push(Buffer.from(b.substring(0, pos), "base64"))
        b = b.substring(pos)
    }
    return Buffer.concat(rs)
}

function _decode_header_qp(data: Buffer): Buffer {
    let str = data.toString()
    let tmpbf = Buffer.allocUnsafe(str.length + 1)
    let tmpbf_i = 0
    let hex: string

    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str[i]
        if (chr == '\r' || chr == '\n') {
            continue
        }
        if (chr == '_') {
            tmpbf[tmpbf_i++] = chr.charCodeAt(0)
            continue
        }
        if (chr === '=' && (hex = str[i + 1] + str[i + 2]) && /[\da-fA-F]{2}/.test(hex)) {
            tmpbf[tmpbf_i++] = parseInt(hex, 16)
            i += 2
            continue
        }
        tmpbf[tmpbf_i++] = chr.charCodeAt(0)
    }
    return Buffer.from(tmpbf.subarray(0, tmpbf_i))
}

export function decodeHeaderQuotedPrintable(data: Buffer): Buffer {
    return _decode_header_qp(data)
}

function _decode_body_base64(data: Buffer): Buffer {
    return Buffer.from(data.toString(), "base64")
}

export function decodeBase64(data: Buffer): Buffer {
    return _decode_body_base64(data)
}


function _decode_body_qp(data: Buffer): Buffer {
    let str = data.toString()
    let tmpbf = Buffer.allocUnsafe(str.length + 1)
    let tmpbf_i = 0
    let hex: string

    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str[i]
        if (chr != '=') {
            tmpbf[tmpbf_i++] = chr.charCodeAt(0)
            continue
        }
        let rn = false
        for (; i < len; i++) {
            let chr2 = str[i + 1]
            if (chr2 == '\r' || chr2 == '\n') {
                rn = true
                continue
            }
            break
        }
        if (rn) {
            continue
        }
        if ((hex = str[i + 1] + str[i + 2]) && /[\da-fA-F]{2}/.test(hex)) {
            tmpbf[tmpbf_i++] = parseInt(hex, 16)
            i += 2
            continue
        }
    }
    return Buffer.from(tmpbf.subarray(0, tmpbf_i))
}

export function decodeBodyQuotedPrintable(data: Buffer): Buffer {
    return _decode_body_qp(data)
}

export function decode2231(data: Buffer, withCharset: boolean): TokenNode[] {
    // filename*0="18050
    // filename*0="=?UTF-8?Q?2
    // filename*0*=utf-8'en-us'Buy
    // filename*0*=utf-8''o%3Fe%3
    let bf: Buffer = data
    if (withCharset) {
        let pos = bf.indexOf("'")
        if (pos < 0) {
            return [{ charset: "", data: Buffer.from(bf) }]
        }
        let charset = bf.subarray(0, pos).toString().trim().toUpperCase()
        bf = bf.subarray(pos + 1)
        pos = bf.indexOf("'")
        if (pos > -1) {
            bf = bf.subarray(pos + 1)
        }
        let str = bf.toString()
        let hex: string
        let tmpbf: Buffer = Buffer.allocUnsafe(str.length)
        let tmpbf_i: number = 0
        for (let i = 0, len = str.length; i < len; i++) {
            let chr = str[i]
            if (chr === '%' && (hex = str[i + 1] + str[i + 2]) && /[\da-fA-F]{2}/.test(hex)) {
                tmpbf[tmpbf_i++] = parseInt(hex, 16)
                i += 2
                continue
            }
            tmpbf[tmpbf_i++] = chr.charCodeAt(0)
        }
        return [{ charset: charset, data: Buffer.from(tmpbf.subarray(0, tmpbf_i)) }]
    } else {
        return decodeValue(data)
    }
}

export function decode2231ToString(data: Buffer, withCharset: boolean): string {
    let r = ""
    let ts = decode2231(data, withCharset)
    let i = 0
    for (i = 0; i < ts.length; i++) {
        r += decodeBufferToStringMaybeDetactCharset(ts[i].data, ts[i].charset)
    }
    return r
}

export function decodeParamValueToString(data: Buffer): string {
    let is2231 = true
    let bf = data
    do {
        let pos = bf.indexOf("'")
        if ((pos < 0) || (pos > 20)) {
            is2231 = false
            break
        }
        let pos2 = bf.indexOf("'", pos + 1)
        if (pos2 < 0 || pos2 - pos > 20) {
            is2231 = false
            break
        }
        let pos3 = bf.indexOf("'", pos2 + 1)
        if (pos3 > -1) {
            is2231 = false
            break
        }
    } while (0)

    if (is2231) {
        for (let i = 0; i < bf.length; i++) {
            if (bf[i] & 0X80) {
                is2231 = false
                break
            }
        }
    }
    if (is2231) {
        return decode2231ToString(data, true)
    }
    return decodeValueToString(data)
}

export function decodeParamToString(params: { [name: string]: Buffer }, name: string): string {
    name = name.toUpperCase()
    if (params[name]) {
        return decodeValueToString(params[name])
    }
    if (params[name + "*"]) {
        let bf: Buffer = params[name + "*"]
        let count = 0
        for (let i = 0; i < bf.length; i++) {
            if (bf[i] == "'".charCodeAt(0)) {
                count++
            }
        }
        return decode2231ToString(bf, (count == 2))
    }
    if (params[name + "*0*"]) {
        let bfs: Buffer[] = []
        for (let i = 0; params[name + "*" + i + "*"]; i++) {
            bfs.push(params[name + "*" + i + "*"])
        }
        return decode2231ToString(Buffer.concat(bfs), true)
    }
    if (params["FILENAME*0"]) {
        let bfs: Buffer[] = []
        for (let i = 0; params[name + "*" + i]; i++) {
            bfs.push(params[name + "*" + i])
        }
        return decode2231ToString(Buffer.concat(bfs), false)
    }
    return ""
}

function _get_one_first_header_line(headers: MimeLine[], name: string) {
    return headers.find(ml => (ml.name == name)) || null
}

function _get_one_first_header_line_string_value(headers: MimeLine[], name: string, def: string) {
    let n = headers.find(ml => (ml.name == name)) || null
    if (!n) {
        return def
    }
    return n.value.toString()
}

export function decodeValue(line: Buffer): TokenNode[] {
    interface tokenNodeWithEncoding extends TokenNode {
        encoding: string
    }
    let rs: tokenNodeWithEncoding[] = []
    function _rs_push(item: tokenNodeWithEncoding) {
        if (item.charset == "" || rs.length < 1) {
            rs.push(item)
        } else {
            let last = rs[rs.length - 1]
            if (last.charset == item.charset && last.encoding == item.encoding) {
                last.data = Buffer.concat([last.data, item.data])
            } else {
                rs.push(item)
            }
        }
    }
    let bf: Buffer, bf_begin: Buffer = line
    let pos: number
    let magic_offet = 0

    while (bf_begin.length) {
        bf = bf_begin
        pos = bf.indexOf("=?", magic_offet)
        magic_offet = 0
        if (pos < 0) {
            _rs_push({ charset: "", data: Buffer.from(bf), encoding: "" })
            break
        }
        if (pos > 0) {
            _rs_push({ charset: "", data: Buffer.from(bf.subarray(0, pos)), encoding: "" })
            bf = bf.subarray(pos)
        }
        bf_begin = bf
        bf = bf.subarray(2)
        pos = bf.indexOf("?")
        if (pos < 2) {
            magic_offet = 2
            bf = bf_begin
            continue
        }
        let charset = bf.subarray(0, pos).toString().toUpperCase()
        bf = bf.subarray(pos + 1)
        if (bf.length < 4) {
            magic_offet = 2
            continue
        }
        let encoding = String.fromCharCode(bf[0]).toUpperCase()
        if (encoding != "B" && encoding != "Q") {
            magic_offet = 2
            continue
        }
        if (bf[1] != "?".charCodeAt(0)) {
            magic_offet = 2
            continue
        }
        bf = bf.subarray(2)
        pos = bf.indexOf("?=")
        if (pos > -1) {
            bf_begin = bf.subarray(pos + 2)
            _rs_push({ charset: charset, data: Buffer.from(bf.subarray(0, pos)), encoding: encoding })
            continue
        }
        pos = _line_buffer_find_char(bf, " \t")

        if (pos > -1) {
            bf_begin = bf.subarray(pos)
            _rs_push({ charset: charset, data: Buffer.from(bf.subarray(0, pos)), encoding: encoding })
            continue
        }
        _rs_push({ charset: charset, data: Buffer.from(bf), encoding: encoding })
        break
    }

    let newRs: TokenNode[] = []
    rs.forEach(item => {
        let data: Buffer
        if (item.encoding == "B") {
            data = _decode_header_base64(item.data)
        } else if (item.encoding == "Q") {
            data = _decode_header_qp(item.data)
        } else {
            data = item.data
        }
        newRs.push({ charset: item.charset, data: data })
    })

    return newRs
}

export function decodeValueToString(line: Buffer): string {
    let r = ""
    let ts = decodeValue(line)
    let i = 0
    for (i = 0; i < ts.length; i++) {
        r += decodeBufferToStringMaybeDetactCharset(ts[i].data, ts[i].charset)
    }
    return r
}

export function decodeLineToValueAndParams(line: Buffer): MimeValueParams {
    // Content-Disposition: inline; filename="123.jpg"
    // Content-Type: text/plain; charset=gbk; format=flowed
    let r: MimeValueParams = {
        value: Buffer.alloc(0),
        params: {}
    }
    let tmpbf = Buffer.alloc(line.length + 1)
    let tmpbf_i = 0
    let bf: Buffer = line
    let pos: number, i: number

    function _get_value_and_left(bf: Buffer) {
        if (bf.length < 1) {
            return null
        }
        let pos = _line_buffer_skip_char(bf, " \t")
        if (pos < 0) {
            return null
        }
        bf = bf.subarray(pos)
        if (bf.length < 1) {
            return null
        }
        if (bf[0] == "\"".charCodeAt(0)) {
            bf = bf.subarray(1)
            tmpbf_i = 0
            let i = 0
            while (i < bf.length) {
                let ch = bf[i++]
                if (ch == "\"".charCodeAt(0)) {
                    break
                }
                if (ch != "\\".charCodeAt(0)) {
                    tmpbf[tmpbf_i++] = ch
                    continue
                }
                if (i == bf.length) {
                    break
                }
                tmpbf[tmpbf_i++] = bf[i++]
            }
            return {
                leftbf: bf.subarray(i + 1),
                value: Buffer.from(tmpbf.subarray(0, tmpbf_i)),
            }
        } else {
            pos = _line_buffer_find_char(bf, " \t;")
            if (pos < 0) {
                return {
                    value: Buffer.from(bf),
                    leftbf: Buffer.alloc(0)
                }
            } else {
                return {
                    value: Buffer.from(bf.subarray(0, pos)),
                    leftbf: bf.subarray(pos + 1)
                }
            }
        }
    }

    // value
    let vl = _get_value_and_left(bf)
    if (!vl) {
        return r
    }
    r.value = vl.value
    bf = vl.leftbf

    // key=value ...
    while (bf.length > 0) {
        // key
        pos = _line_buffer_skip_char(bf, " \t;")
        if (pos < 0) {
            return r
        }
        bf = bf.subarray(pos)
        pos = _line_buffer_find_char(bf, " \t;=")
        if (pos < 0) {
            return r
        }
        let name = bf.subarray(0, pos).toString().toUpperCase()

        // =
        bf = bf.subarray(pos)
        if (bf[0] != "=".charCodeAt(0)) {
            pos = bf.indexOf("=")
            if (pos < 0) {
                return r
            }
            bf = bf.subarray(pos)
        } else {
            bf = bf.subarray(1)
        }

        // value
        let vl = _get_value_and_left(bf)
        if (!vl) {
            return r
        }
        bf = vl.leftbf

        r.params[name] = vl.value
    }
    return r
}

export function decodeMimeAddressLineUtf8(line: Buffer | String): MimeAddress[] {
    let r: MimeAddress[] = []
    if (!Buffer.isBuffer(line)) {
        line = Buffer.from(line)
    }
    decodeMimeAddressLine(line).forEach(lo => {
        let ro: MimeAddress = { name: "", address: "" }
        ro.address = lo.address.toLowerCase().trim()
        ro.name = decodeValueToString(lo.nameBuffer).trim()
        r.push(ro)
    })
    return r
}

function decodeMimeAddressLine(line: Buffer): MimeAddressDecoder[] {
    let mas: MimeAddressDecoder[] = []
    let tmpbf = Buffer.alloc(line.length + 1)
    let bf = line

    while (bf.length) {
        let ma = _decode_one(bf, tmpbf)
        if (ma === null) {
            break
        }
        if (ma.address != "" || ma.nameBuffer.length) {
            mas.push({ nameBuffer: ma.nameBuffer, address: ma.address })
        }
        bf = ma.leftbf
    }
    return mas

    function _decode_one(line: Buffer, tmpbf: Buffer) {
        let found_lt = false
        let name: null | Buffer = null
        let address: null | Buffer = null
        let i = 0
        let tmpbf_i = 0
        let bf: Buffer = line
        let pos: number
        pos = _line_buffer_skip_char(bf, " \t")
        if (pos < 0) {
            return null
        }
        bf = bf.subarray(pos)
        i = 0
        while (i < bf.length && !found_lt) {
            let ch = bf[i++]
            let chch = String.fromCharCode(ch)
            if (chch == '"') {
                while (i < bf.length) {
                    ch = bf[i++]
                    chch = String.fromCharCode(ch)
                    if (chch == "\\") {
                        if (i == bf.length) {
                            break
                        }
                        tmpbf[tmpbf_i++] = bf[i++]
                        continue
                    } else if (chch == "\"") {
                        break
                    } else {
                        tmpbf[tmpbf_i++] = ch
                    }
                }
                if (i == bf.length) {
                    name = Buffer.from(tmpbf.subarray(0, tmpbf_i))
                    tmpbf_i = 0
                    break
                }
            } else if (chch == "," || chch == ";") {
                name = Buffer.from(tmpbf.subarray(0, tmpbf_i))
                tmpbf_i = 0
                break
            } else if (chch == '<') {
                found_lt = true
                name = Buffer.from(tmpbf.subarray(0, tmpbf_i))
                tmpbf_i = 0
                while (i < bf.length) {
                    ch = bf[i++]
                    chch = String.fromCharCode(ch)
                    if (chch == "<") {
                        tmpbf[tmpbf_i++] = " ".charCodeAt(0)
                        name = Buffer.concat([name, Buffer.from("<"), tmpbf.subarray(0, tmpbf_i)])
                        tmpbf_i = 0
                        continue
                    }
                    chch = String.fromCharCode(ch)
                    if (chch == "," || chch == ";" || chch == ">") {
                        address = Buffer.from(tmpbf.subarray(0, tmpbf_i))
                        break
                    }
                    tmpbf[tmpbf_i++] = ch
                    if (i == bf.length) {
                        address = Buffer.from(tmpbf.subarray(0, tmpbf_i))
                        break
                    }
                }
                continue
            } else {
                tmpbf[tmpbf_i++] = ch
                if (i == bf.length) {
                    name = Buffer.from(tmpbf.subarray(0, tmpbf_i))
                    tmpbf_i = 0
                    break
                }
            }
        }
        let leftbf = bf.subarray(i)
        if (address == null) {
            if (name && name.indexOf('@') > -1) {
                address = name
                name = null
            }
        }
        if (address == null) {
            address = Buffer.alloc(0)
        }
        if (name == null) {
            name = Buffer.alloc(0)
        }
        let av = address.toString().trim()
        return {
            leftbf: leftbf,
            nameBuffer: name,
            address: av,
        }
    }
}

export class mimeNode {
    parser: emlParser
    headerStartPos: number
    headerLength: number
    headers: MimeLine[]
    bodyStartPos: number
    bodyLength: number
    contentType: string
    encoding: "BASE64" | "QUOTED-PRINTABLE" | ""
    charset: string
    name: string
    filename: string
    contentId: string
    disposition: string
    boundary: string
    __textContent: null | string
    __isInline: boolean
    __isTnef: boolean
    parent: null | mimeNode
    childs: null | mimeNode[]
    constructor(parser: emlParser) {
        this.parser = parser
        this.headerStartPos = 0
        this.headerLength = 0
        this.headers = []
        this.bodyStartPos = 0
        this.bodyLength = 0
        this.contentType = ""
        this.encoding = ""
        this.charset = ""
        this.name = ""
        this.filename = ""
        this.contentId = ""
        this.disposition = ""
        this.boundary = ""
        this.__textContent = null
        this.__isInline = false
        this.__isTnef = false
        this.parent = null
        this.childs = null
    }

    get isInline() {
        this.parser.magicFriendCall(this, "inline", "20240909")
        return this.__isInline
    }

    get isTnef() {
        this.parser.magicFriendCall(this, "basic", "20240909")
        return this.__isTnef
    }

    get textContent(): string {
        if (this.__textContent === null) {
            this.parser.magicFriendCall(this, "text_content", "20240909")
        }
        return this.__textContent || ""
    }

    getDecodedBuffer(): Buffer {
        return this.parser.magicFriendCall(this, "content", "20240909")
    }

    getFirstHeaderLine(name: string): null | MimeLine {
        return _get_one_first_header_line(this.headers, name.toUpperCase())
    }

    getFirstHeaderValue(name: string, def: string = ""): string {
        return _get_one_first_header_line_string_value(this.headers, name.toUpperCase(), def)
    }
}

export class emlParser {
    emlData: Buffer
    debugMode: boolean
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
    topNode: mimeNode
    private __textNodes: mimeNode[]
    private __alternativeShowNodes: mimeNode[]
    private __attachmentNodes: mimeNode[]
    private __allNodes: mimeNode[]

    magicFriendCall(node: mimeNode, action: string, magic: string) {
        if (magic != "20240909") {
            return Buffer.alloc(0)
        }
        if (action == "inline") {
            this._classify_mime_node_inline()
        } else if (action == "basic") {
            this._classify_mime_node_basic()
        } else if (action == "text_content") {
            this._decode_text_content(node)
        } else if (action == "content") {
            return this._decode_content(node)
        }
        return Buffer.alloc(0)
    }

    constructor(options: ParserOptions) {
        options = options || {}
        this.emlData = options.emlData || Buffer.alloc(0)
        this.debugMode = (options.debug === true)
        this.subject = null
        this.from = null
        this.to = null
        this.cc = null
        this.bcc = null
        this.messageId = null
        this.date = null
        this.dateUnix = 0
        this.sender = null
        this.replyTo = null
        this.dispositionNotificationTo = null
        this.topNode = new mimeNode(this)
        this.__textNodes = []
        this.__alternativeShowNodes = []
        this.__attachmentNodes = []
        this.__allNodes = []
        this._parse()
    }
    get alternativeShowNodes(): mimeNode[] {
        this._classify_mime_node_alternative()
        return this.__alternativeShowNodes
    }

    get attachmentNodes(): mimeNode[] {
        this._classify_mime_node_basic()
        return this.__attachmentNodes
    }
    get textNodes(): mimeNode[] {
        this._classify_mime_node_basic()
        return this.__textNodes
    }

    get allNodes(): mimeNode[] {
        this._classify_mime_node_all()
        return this.__allNodes
    }

    getFirstHeaderLine(name: string): null | MimeLine {
        return _get_one_first_header_line(this.topNode.headers, name.toUpperCase())
    }

    getFirstHeaderValue(name: string, def: string = ""): string {
        return _get_one_first_header_line_string_value(this.topNode.headers, name.toUpperCase(), def)
    }

    private _find_all_maybe_boundary(data: Buffer) {
        let boundarys: mime_boundary[] = []
        let offset = 0
        while (offset < data.length) {
            let bf = data.subarray(offset)
            let pos: number = 0
            if (bf.subarray(0, 2).toString().startsWith("--")) {
                pos = -1
            } else {
                pos = bf.indexOf("\n--")
                if (pos < 0) {
                    break
                }
            }
            bf = bf.subarray(pos + 3)
            let n_pos = bf.indexOf("\n")
            if (n_pos > 256) {
                break
            }
            boundarys.push({
                boundary: bf.subarray(0, n_pos).toString().trimEnd(),
                startPos: offset + pos + 1,
                endPos: offset + pos + 3 + n_pos + 1,
            })
            offset += pos + 3 + n_pos + 1
        }
        return boundarys
    }

    private _decode_mime_one_level(data: Buffer): mimeNode {
        let i = 0
        let rnode: mimeNode = new mimeNode(this)

        // header
        let tmplen = 3
        let pos = data.indexOf("\n\r\n")
        if (pos < 0) {
            tmplen = 2
            pos = data.indexOf("\n\n")
        }
        let header_buf: Buffer
        if (pos > 0) {
            header_buf = data.subarray(0, pos + 1)
            rnode.bodyStartPos = pos + 1
            rnode.bodyLength = data.length - (pos + tmplen)
        } else {
            header_buf = data
            rnode.bodyStartPos = data.length
            rnode.bodyLength = 0
        }
        rnode.headerLength = header_buf.length

        // parse header
        function _one_line(line: Buffer) {
            let i = 0
            for (i = 0; i < line.length; i++) {
                if (line[i] == ':'.charCodeAt(0)) {
                    break
                }
            }
            if (i == line.length) {
                rnode.headers.push({ name: line.toString(), value: Buffer.alloc(0) })
            } else {
                rnode.headers.push({ name: line.subarray(0, i).toString().trimEnd().toUpperCase(), value: Buffer.from(line.subarray(i + 1)) })
            }
        }
        let tmpbf = Buffer.allocUnsafe(header_buf.length + 1)
        let tmpbf_i = 0
        while (i < header_buf.length) {
            let ch = header_buf[i++]
            let chch = String.fromCharCode(ch)
            if (chch == "\r") {
                continue
            }
            if (chch != "\n") {
                tmpbf[tmpbf_i++] = ch
                continue
            }
            if (i == header_buf.length) {
                break
            }
            ch = header_buf[i++]
            chch = String.fromCharCode(ch)
            if (chch == " " || chch == "\t") {
                continue
            }
            if (tmpbf_i > 0) {
                _one_line(tmpbf.subarray(0, tmpbf_i))
                tmpbf_i = 0
            }
            tmpbf[tmpbf_i++] = ch
        }
        if (tmpbf_i > 0) {
            _one_line(tmpbf.subarray(0, tmpbf_i))
            tmpbf_i = 0
        }
        return rnode
    }

    private _decode_mime_self(data: Buffer) {
        let rnode = this._decode_mime_one_level(data)
        let ml: null | MimeLine
        let vt: MimeValueParams
        let i = 0

        //
        ml = _get_one_first_header_line(rnode.headers, "CONTENT-TRANSFER-ENCODING")
        if (ml) {
            let v = ml.value.toString().trim().toUpperCase()
            if (v == "BASE64" || v == "QUOTED-PRINTABLE") {
                rnode.encoding = v
            } else {
                rnode.encoding = v as any
            }
        }
        //
        ml = _get_one_first_header_line(rnode.headers, "CONTENT-TYPE")
        if (ml) {
            vt = decodeLineToValueAndParams(ml.value)
            rnode.contentType = vt.value.toString().toUpperCase()
            if (vt.params["CHARSET"]) {
                rnode.charset = vt.params["CHARSET"].toString().toUpperCase()
            }
            if (vt.params["NAME"]) {
                rnode.name = decodeValueToString(Buffer.from(vt.params["NAME"]))
            }
            if (vt.params["BOUNDARY"]) {
                rnode.boundary = vt.params["BOUNDARY"].toString().trim()
            }
        } else {
            rnode.contentType = "TEXT/PLAIN"
        }
        // 
        ml = _get_one_first_header_line(rnode.headers, "CONTENT-DISPOSITION")
        if (ml) {
            vt = decodeLineToValueAndParams(ml.value)
            rnode.disposition = vt.value.toString().toUpperCase()
            rnode.filename = decodeParamToString(vt.params, "FILENAME")
        } else {
            // rnode.disposition = "ATTACHMENT"
        }
        //
        ml = _get_one_first_header_line(rnode.headers, "CONTENT-ID")
        if (ml) {
            let v = ml.value.toString().trim()
            if (v.length > 0) {
                if (v[0] == '<') {
                    v = v.substring(1)
                }
            }
            if (v.length > 0) {
                if (v[v.length - 1] == '>') {
                    v = v.substring(0, v.length - 1)
                }
            }
            rnode.contentId = v
        }
        // now showName

        return rnode
    }

    private _decode_mime(attrs: { offset: number, emlData: Buffer, data: Buffer, boundarys: mime_boundary[], end: number }) {
        let thisObj = this
        let node = this._decode_mime_self(attrs.data)
        node.headerStartPos += attrs.offset
        node.bodyStartPos += attrs.offset

        if (!node.contentType.startsWith("MULTIPART/")) {
            return node
        }
        node.childs = []
        if (node.boundary == "") {
            return node
        }

        let bi = 0
        let lastIdx = -1
        for (bi = 0; bi < attrs.boundarys.length; bi++) {
            let bo = attrs.boundarys[bi]
            if (node.boundary == bo.boundary || node.boundary + "--" == bo.boundary) {
                if (lastIdx == -1) {
                    lastIdx = bi
                    continue
                }
                let so = attrs.boundarys[lastIdx]
                let eo = attrs.boundarys[bi]
                let nextNode = this._decode_mime({ offset: so.endPos, emlData: attrs.emlData, data: attrs.emlData.subarray(so.endPos, eo.startPos), boundarys: attrs.boundarys.slice(lastIdx + 1, bi), end: eo.startPos - 1 })
                node.childs.push(nextNode)
                nextNode.parent = node
                lastIdx = bi
            }
        }
        if ((lastIdx > -1) && lastIdx + 1 < attrs.boundarys.length) {
            bi = attrs.boundarys.length - 1
            let so = attrs.boundarys[lastIdx]
            let eo = attrs.boundarys[bi]
            let nextNode = this._decode_mime({ offset: so.endPos, emlData: attrs.emlData, data: attrs.emlData.subarray(so.endPos, attrs.end), boundarys: attrs.boundarys.slice(lastIdx + 1, bi), end: attrs.end })
            node.childs.push(nextNode)
            nextNode.parent = node
        }

        return node
    }

    private _decode_content(node: mimeNode): Buffer {
        let contentBuffer: Buffer
        if (node.encoding == "BASE64") {
            contentBuffer = _decode_body_base64(this.emlData.subarray(node.bodyStartPos, node.bodyStartPos + node.bodyLength))
        } else if (node.encoding == "QUOTED-PRINTABLE") {
            contentBuffer = _decode_body_qp(this.emlData.subarray(node.bodyStartPos, node.bodyStartPos + node.bodyLength))
        } else {
            contentBuffer = Buffer.from(this.emlData.subarray(node.bodyStartPos, node.bodyStartPos + node.bodyLength))
        }
        return contentBuffer
    }

    private _decode_text_content(node: mimeNode): string {
        if (node.__textContent !== null) {
            return node.__textContent
        }
        let contentBuffer = this._decode_content(node)
        let con = decodeBufferToStringMaybeDetactCharset(contentBuffer, node.charset)
        node.__textContent = con
        return node.__textContent
    }

    // 全部节点
    _classify_mime_node_all() {
        let thisAny = this as any
        if (thisAny.__V_classify_mime_node_all) {
            return
        }
        thisAny.__V_classify_mime_node_all = true
        this._classify_mime_node_all()
        let thisObj = this
        function _walk_all_node(node: mimeNode) {
            thisObj.__allNodes.push(node)
            const type = node.contentType
            const mainType = type.split("/")[0]
            if (mainType === "MULTIPART") {
                if (node.childs) {
                    node.childs.forEach(n => {
                        _walk_all_node(n)
                    })
                }
                return
            }
        }
        _walk_all_node(this.topNode)
    }

    // 分类: 文本类和附件类
    private _classify_mime_node_basic() {
        let thisAny = this as any
        if (thisAny.__V_classify_mime_node_basic) {
            return
        }
        thisAny.__V_classify_mime_node_basic = true
        let thisObj = this
        function _walk_all_node(node: mimeNode) {
            const type = node.contentType
            const mainType = type.split("/")[0]
            if (mainType === "MULTIPART") {
                if (node.childs) {
                    node.childs.forEach(n => {
                        _walk_all_node(n)
                    })
                }
                return
            }
            if (mainType === "APPLICATION") {
                thisObj.__attachmentNodes.push(node)
                if (type.indexOf('TNEF') > 0) {
                    node.__isTnef = true
                }
                return
            }
            if (node.disposition === "ATTACHMENT") {
                thisObj.__attachmentNodes.push(node)
                return
            }
            if (mainType === "MESSAGE") {
                if (type.indexOf("DELIVERY") > 0 || type.indexOf("NOTIFICATION") > 0) {
                    thisObj.__textNodes.push(node)
                } else {
                    thisObj.__attachmentNodes.push(node)
                }
                return
            }
            if (mainType === 'TEXT') {
                if (type.indexOf("/PLAIN") > 0 || type.indexOf("/HTML") > 0) {
                    thisObj.__textNodes.push(node)
                } else {
                    thisObj.__attachmentNodes.push(node)
                }
                return
            }
            // if (mainType === "IMAGE" || mainType === "AUDIO" || mainType === "VIDEO") {
            //   ms.__attachmentNodes.push(node)
            //   return
            // }
            thisObj.__attachmentNodes.push(node)
            return
        }
        _walk_all_node(this.topNode)
    }

    // 找应该优先显示的node
    private _classify_mime_node_alternative() {
        let thisAny = this as any
        if (thisAny.__V_classify_mime_node_alternative) {
            return
        }
        thisAny.__V_classify_mime_node_alternative = true
        this._classify_mime_node_basic()
        let tmpShowVector: mimeNode[] = []
        let tmpShowSet: any = {}
        let alternativeKey = ""
        this.__textNodes.forEach(node => {
            const subType = node.contentType.split("/")[1] || ""
            if (subType !== "HTML" && subType !== "PLAIN") {
                tmpShowVector.push(node)
                return
            }
            let parent: mimeNode | null = node.parent
            while (parent) {
                if (parent.contentType === "MULTIPART/ALTERNATIVE") {
                    alternativeKey = "^_^" + parent.headerStartPos
                    break
                }
                parent = parent.parent
            }
            if (alternativeKey === "") {
                tmpShowVector.push(node)
                return
            }
            if (!tmpShowSet[alternativeKey]) {
                tmpShowSet[alternativeKey] = {}
            }
            tmpShowSet[alternativeKey][subType] = node
        })
        for (alternativeKey in tmpShowSet) {
            if (!alternativeKey.startsWith("^_^")) {
                continue
            }
            const ns = tmpShowSet[alternativeKey]
            if (ns.HTML) {
                tmpShowVector.push(ns.HTML)
            } else if (ns.PLAIN) {
                tmpShowVector.push(ns.PLAIN)
            }
        }
        tmpShowVector.sort((a, b) => { return a.headerStartPos - b.headerStartPos })
        this.__alternativeShowNodes = tmpShowVector
    }
    // 识别内嵌图片附件
    private _classify_mime_node_inline() {
        let thisAny = this as any
        if (thisAny.__V_classify_mime_node_inline) {
            return
        }
        thisAny.__V_classify_mime_node_inline = true
        this._classify_mime_node_alternative()
        let thisObj = this
        let hasContentId = false
        this.__attachmentNodes.forEach((m) => {
            if (m.contentId == "") {
                return
            }
            hasContentId = true
        })
        if (!hasContentId) {
            return
        }
        let con = ""
        this.__alternativeShowNodes.forEach((n) => {
            thisObj._decode_text_content(n)
            con += "\n" + n.__textContent
        })
        con = con.toLowerCase()
        this.__attachmentNodes.forEach((m) => {
            if (m.contentId == "") {
                return
            }
            // 这么搜是不严谨的,但一般不会出错,就算出错问题也不大,一般常见的业务够了
            // 应该把html转发为DOM, 一个一个的检查href / src等
            if (con.indexOf("cid:" + m.contentId.toLowerCase()) > -1) {
                m.__isInline = true
            }
        })
    }

    private _decode_header_subject() {
        let topNode = this.topNode
        let ml: null | MimeLine
        //
        ml = _get_one_first_header_line(topNode.headers, "SUBJECT")
        if (ml) {
            this.subject = decodeValueToString(ml.value)
        }
    }

    private _decode_header_message_id() {
        let topNode = this.topNode
        let ml: null | MimeLine
        //
        ml = _get_one_first_header_line(topNode.headers, "MESSAGE-ID")
        if (ml) {
            let a = ml.value.toString().trim()
            if (a.startsWith("<")) {
                a = a.substring(1)
            }
            if (a.endsWith(">")) {
                a = a.substring(0, a.length - 1)
            }
            a = a.trim()
            this.messageId = a
        }
    }

    private _decode_header_date() {
        let topNode = this.topNode
        let ml: null | MimeLine
        //
        this.date = ""
        this.dateUnix = -1
        ml = _get_one_first_header_line(topNode.headers, "DATE")
        if (ml) {
            this.date = ml.value.toString()
        } else {

            let r = topNode.headers.findLast(ml => (ml.name == "RECEIVED")) || null
            if (r) {
                let v = r.value.toString()
                let pos = v.lastIndexOf(";")
                if (pos > 0) {
                    this.date = v.substring(pos + 1).trim()
                }
            }
        }

        try {
            this.dateUnix = (new Date(this.date)).getTime() / 1000
        } catch {
            this.dateUnix = -1
        }
        if (Number.isNaN(this.dateUnix)) {
            this.dateUnix = -1
        }
    }

    decodeHeaderAddress(headerName: string) {
        let topNode = this.topNode
        let ml: null | MimeLine
        //
        ml = _get_one_first_header_line(topNode.headers, headerName)
        if (!ml) {
            return null
        }
    }

    private _decode_header_address(key: string, headerName: string, isArray: boolean) {
        let topNode = this.topNode
        let ml = _get_one_first_header_line(topNode.headers, headerName)
        if (!ml) {
            return
        }
        let r = decodeMimeAddressLineUtf8(ml.value);
        if (isArray) {
            (this as any)[key] = r
        } else if (r.length > 0) {
            (this as any)[key] = r[0]
        }
    }

    private _decode_headers() {
        this._decode_header_subject()
        this._decode_header_message_id()
        this._decode_header_date()
        this._decode_header_address("from", "FROM", false)
        this._decode_header_address("to", "TO", true)
        this._decode_header_address("cc", "CC", true)
        this._decode_header_address("bcc", "BCC", true)
        this._decode_header_address("sender", "SENDER", false)
        this._decode_header_address("replyTo", "REPLY-TO", false)
        this._decode_header_address("dispositionNotificationTo", "DISPOSITION-NOTIFICATION-TO", false)
    }

    private references: string[] | null = null
    getReferences(): string[] {
        if (this.references !== null) {
            return this.references
        }
        function messageTrim(m: string) {
            let a = m.trim()
            if (a.startsWith("<")) {
                a = a.substring(1)
            }
            if (a.endsWith(">")) {
                a = a.substring(0, a.length - 1)
            }
            a = a.trim()
            return a
        }

        let references: string[] = []
        let v = this.getFirstHeaderValue("References")
        let vs = v.split(/,|;| <|\t</)
        let keys: any = {}
        vs.forEach(v => {
            v = messageTrim(v)
            if (!v || keys[v]) {
                return
            }
            keys[v] = true
            references.push(v)
        })
        this.references = references
        return this.references
    }

    private _parse() {
        let boundarys = this._find_all_maybe_boundary(this.emlData)
        let topNode = this._decode_mime({ offset: 0, emlData: this.emlData, data: this.emlData, boundarys: boundarys, end: this.emlData.length })
        this.topNode = topNode
        this._decode_headers()
    }
}